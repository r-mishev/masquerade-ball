const sharp = require('sharp');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

// Configure GMAIL Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_PASSWORD // Use App Password if 2FA is on
  }
});

const generateAndEmail = async (donation) => {
  try {
    const svgPath = path.join(__dirname, '../assets/cert.svg');
    const pngPath = path.join(__dirname, '../assets/cert.png');

    // 1. Read the SVG strictly to find Coordinates (Lightweight text processing)
    const svgContent = await fs.readFile(svgPath, 'utf-8');
    const $ = cheerio.load(svgContent, { xmlMode: true });

    // Extract ViewBox (to ensure alignment matches the PNG)
    const viewBox = $('svg').attr('viewBox') || '0 0 800 600'; // Default fallback
    const [width, height] = viewBox.split(' ').slice(2);

    // Helper to get coordinates
    const getCoordinates = (selector) => {
      const d = $(selector).attr('d');
      if (!d) return { x: 100, y: 100 }; // Fallback if path not found
      
      const match = d.match(/M\s*([\d.]+)[,\s]+([\d.]+)/i);
      if (match) {
        return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
      }
      return { x: 100, y: 100 };
    };

    // Get coords for Name and Amount
    const nameCoords = getCoordinates('.donorName');
    const amountCoords = getCoordinates('.donorAmount');

    // 2. Create a "Text Overlay" SVG
    // This is a transparent SVG containing ONLY the text. It is tiny and won't crash the server.
    const textOverlay = `
      <svg width="${width}" height="${height}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .text { fill: black; font-family: Arial, sans-serif; font-weight: bold; }
        </style>
        
        <text x="${nameCoords.x}" y="${nameCoords.y - 15}" font-size="32" class="text">
          ${donation.donorName}
        </text>

        <text x="${amountCoords.x}" y="${amountCoords.y - 15}" font-size="40" class="text">
          $${donation.amount.toFixed(2)}
        </text>
      </svg>
    `;

    // 3. Composite the Text Overlay onto the PNG
    const finalImageBuffer = await sharp(pngPath)
      .composite([
        { input: Buffer.from(textOverlay), top: 0, left: 0 }
      ])
      .png()
      .toBuffer();

    // 4. Send Email
    await transporter.sendMail({
      from: `"Student Government" <${process.env.GMAIL_EMAIL}>`,
      to: donation.donorEmail,
      subject: "🎄 Thank You for Your Christmas Donation! 🎄",
      html: `
        <h3>Dear ${donation.donorName},</h3><br/>
        <p>Thank you so much for your generous donation of <strong>$${donation.amount}</strong>.</p>
        <p>Attached is your personalized Certificate of Donation along with our heartfelt wishes for a Merry Christmas!</p>
        <p>Yours,<br/>The Student Government</p>
      `,
      attachments: [
        {
          filename: 'Certificate.png',
          content: finalImageBuffer
        }
      ]
    });

    console.log(`Certificate sent to ${donation.donorEmail}`);

  } catch (error) {
    console.error("Automation Error:", error);
  }
};

module.exports = { generateAndEmail };