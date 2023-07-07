const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const cheerio = require('cheerio');

const execFilePromise = promisify(execFile);
const writeFilePromise = promisify(fs.writeFile);
const readFilePromise = promisify(fs.readFile);
const accessPromise = promisify(fs.access);
const unlinkPromise = promisify(fs.unlink);

const app = express();

app.use(express.json({ limit: '50mb' }));

app.post('/htmlToPdf', async (req, res) => {
  const { html } = req.body;

  if (!html) {
    res.status(400).send('Please provide "html" in the request body.');
    return;
  }

  // Load the HTML content with Cheerio
  const $ = cheerio.load(html);

  // Replace custom <qrcode> element with the desired <img> element
  $('qrcode').each((_, el) => {
    const qrcode = $(el).attr('value');
    const img = `<img width=150 src="https://tickets.voordemensen.nl/qr/${qrcode}">`;
    $(el).replaceWith(img);
  });

  // Wrap each <page> element's content in a separate <div> with the 'page' class, except for the last one
  const pageCount = $('page').length;
  $('page').each((index, el) => {
    if (index === pageCount - 1) {
      // Do not wrap the last <page> element
      return;
    }
    const content = $(el).html();
    const pageDiv = `<div class="page">${content}</div>`;
    $(el).replaceWith(pageDiv);
  });

  // add UTF8 encoding header
  const utfHeader = `<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">`;
  $('head').append(utfHeader);

  // Add the <style> tag with the 'page-break-before' CSS property for the 'page' class
  const pageBreakStyle = `<style type='text/css'>div.page{page-break-after: always;page-break-inside: avoid;}</style>`;
  $('head').append(pageBreakStyle);

  const updatedHtml = $.html();
  const inputPath = `/tmp/input_${Date.now()}_${Math.floor(Math.random() * 10000)}.html`;
  const outputPath = `/tmp/output_${Date.now()}_${Math.floor(Math.random() * 10000)}.pdf`;
  const wkhtmltopdfPath = '/usr/local/bin/wkhtmltopdf';

  try {
    await writeFilePromise(inputPath, updatedHtml);

    const { stderr } = await execFilePromise(wkhtmltopdfPath, [
                        '--disable-smart-shrinking',
                        '--no-outline',
                        '--page-size',
                        'A4',
                        '--margin-top',
                        '3',
                        '--margin-bottom',
                        '3',
                        '--margin-left',
                        '3',
                        '--margin-right',
                        '3',
                        inputPath,
                        outputPath,
                      ]);
    if (stderr) {
      console.error(stderr);
    }

    await accessPromise(outputPath, fs.constants.R_OK);

    const pdfBuffer = await readFilePromise(outputPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${outputPath.split('/').pop()}`);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to generate PDF.');
  } finally {
    // Delete the file
    try {
      await unlinkPromise(outputPath);
      console.log(`Successfully deleted file ${outputPath}`);
    } catch (error) {
      console.error(`Failed to delete file ${outputPath}:`, error);
    }

    try {
      await unlinkPromise(inputPath);
      console.log(`Successfully deleted file ${inputPath}`);
    } catch (error) {
      console.error(`Failed to delete file ${inputPath}:`, error);
    }
    
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
