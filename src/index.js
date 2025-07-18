const Mustache = require('mustache');
const puppeteer = require('puppeteer');
const readline = require('node:readline');
const fs = require('fs');
const path = require('path');

// Data
const jsonData = fs.readFileSync(path.resolve(__dirname, 'data.json'), 'utf-8');

// Templates
const pathTemplate = path.resolve(__dirname, 'templates');

// Read data
const baseTemplate = fs.readFileSync(path.resolve(pathTemplate, 'base.html'), 'utf-8');
const landlordTableTemplate = fs.readFileSync(path.resolve(pathTemplate, 'landlord-table.html'), 'utf-8');
const invoiceDateTemplate = fs.readFileSync(path.resolve(pathTemplate, 'invoice-date.html'), 'utf-8');
const tenantTableTemplate = fs.readFileSync(path.resolve(pathTemplate, 'tenant-table.html'), 'utf-8');
const conceptsTemplate = fs.readFileSync(path.resolve(pathTemplate, 'concepts.html'), 'utf-8');

const { arrendador, arrendatarios, local, iva } = JSON.parse(jsonData);


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const trimestres = {
    1: ['Enero', 'Febrero', 'Marzo'],
    2: ['Abril', 'Mayo', 'Junio'],
    3: ['Julio', 'Agosto', 'Septiembre'],
    4: ['Octubre', 'Noviembre', 'Diciembre']
};

let meses = [];
let trimestre;

rl.question('Dime el trimestre: ', (answer) => {
    trimestre = parseInt(answer);
    try {
        if (!trimestres[trimestre]) {
            throw new Error('El trimestre debe ser un número entre 1 y 4');
        }
    } catch (error) {
        console.error(error.message);
        rl.close();
    }

    meses = trimestres[trimestre];
    rl.close();
});

rl.on('close', () => {
    if (meses.length) {
        console.log(`Los meses seleccionados son: ${meses.join(', ')}`);

        console.log('Generando facturas...');

        const mesesNumeros = meses.map((_, index) => index + (trimestre * 3) - 2);

        mesesNumeros.forEach((mes, index) => {
            const date = new Date(new Date().getFullYear(), mes - 1, 1);
            const dateFormatted = date.toLocaleDateString('es-ES', { day: '2-digit',month: '2-digit', year: 'numeric' });
            const dateShort = dateFormatted.split('/').slice(0, 2).join('/');

            arrendatarios.forEach(async ({cantidad, precio, ...arrendatario}) => {
                const arrendadorTableView = {
                    arrendador,
                };

                const landlordTableTemplateRendered = Mustache.render(landlordTableTemplate, arrendadorTableView);

                const datesTemplateView = {
                    fecha_factura: dateFormatted,
                    fecha_num_factura: dateShort,
                }

                const invoiceDateTemplateRendered = Mustache.render(invoiceDateTemplate, datesTemplateView);

                const tenantTableView = {
                    arrendatario
                };

                const tenantTableTemplateRendered = Mustache.render(tenantTableTemplate, tenantTableView);

                const total = (cantidad * precio).toFixed(2);
                const total_base = (total / ((100 + iva) / 100)).toFixed(2);
                const pricePerItem = (total_base / cantidad).toFixed(2);
                const items = new Array(cantidad).fill(pricePerItem);
                const mes = meses[index];
                const total_iva = (total - total_base).toFixed(2);

                const conceptsTableView = {
                    local,
                    iva,
                    total_base,
                    total_iva,
                    mes,
                    items,
                    total,
                };

                const conceptsTemplateRendered = Mustache.render(conceptsTemplate, conceptsTableView);

                const template = [landlordTableTemplateRendered, invoiceDateTemplateRendered, tenantTableTemplateRendered, conceptsTemplateRendered].join('\n');

                const source = Mustache.render(baseTemplate, { template }, undefined, {escape: (text) => text});

                const outputDir = path.resolve(__dirname, '../dist', arrendatario.nombre);
                const outputPath = path.join(outputDir, `${mes}.pdf`);
                fs.mkdirSync(outputDir, { recursive: true });
                try {
                    const browser = await puppeteer.launch({ headless: true });
                    const page = await browser.newPage();
                    await page.setContent(source, { waitUntil: 'networkidle0' });
                    await page.pdf({ path: outputPath, format: 'A4', printBackground: true });
                    await browser.close();
                } catch (err) {
                    console.error('Error generating PDF with Puppeteer:', err);
                }
            });

        });


    }
});