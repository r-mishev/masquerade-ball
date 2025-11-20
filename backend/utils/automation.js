const sharp = require('sharp');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// --- GMAIL TRANSPORTER ---
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_PASSWORD,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error connecting to Gmail SMTP:', error);
  } else {
    console.log('✅ Gmail SMTP connection is ready to send emails');
  }
});

const generateAndEmail = async (donation) => {
  try {
    const svgPath = path.join(__dirname, '../assets/cert.svg');
    const pngPath = path.join(__dirname, '../assets/cert.png');

    // 1. Read the SVG strictly to find Coordinates
    const svgContent = await fs.readFile(svgPath, 'utf-8');
    const $ = cheerio.load(svgContent, { xmlMode: true });

    const viewBox = $('svg').attr('viewBox') || '0 0 800 600';
    const [width, height] = viewBox.split(' ').slice(2);

    const getCoordinates = (selector) => {
      const d = $(selector).attr('d');
      if (!d) return { x: 100, y: 100 };
      
      const match = d.match(/M\s*([\d.]+)[,\s]+([\d.]+)/i);
      if (match) {
        return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
      }
      return { x: 100, y: 100 };
    };

    const nameCoords = getCoordinates('.donorName');
    const amountCoords = getCoordinates('.donorAmount');

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

    const finalImageBuffer = await sharp(pngPath)
      .composite([{ input: Buffer.from(textOverlay), top: 0, left: 0 }])
      .png()
      .toBuffer();

    // 4. Send Email
    const info = await transporter.sendMail({
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

    console.log(`✅ Certificate email sent to ${donation.donorEmail}. Message ID: ${info.messageId}`);

  } catch (error) {
    console.error("Automation Error:", error);
  }
};

module.exports = { generateAndEmail };
