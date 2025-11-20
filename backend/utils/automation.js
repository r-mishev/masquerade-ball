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
    // 1. Load the SVG file as a string
    const svgPath = path.join(__dirname, '../assets/cert.svg');
    const svgContent = await fs.readFile(svgPath, 'utf-8');

    // 2. Load into Cheerio to manipulate XML
    const $ = cheerio.load(svgContent, { xmlMode: true });

    // --- HELPER: Function to extract coordinates and insert text ---
    const insertTextAbovePath = (selector, textContent, fontSize = 24) => {
      const pathElement = $(selector);
      
      if (pathElement.length > 0) {
        // Get the 'd' attribute (e.g., "M 100 200 L 300 200...")
        const d = pathElement.attr('d');
        
        // Regex to find the starting 'M' coordinates (Move To x y)
        // Matches "M 150 300" or "M150,300"
        const match = d.match(/M\s*([\d.]+)[,\s]+([\d.]+)/i);

        if (match) {
          const x = parseFloat(match[1]);
          const y = parseFloat(match[2]);

          // Create a text element
          // y - 15 puts it 15 pixels ABOVE the line
          const textNode = `
            <text 
              x="${x}" 
              y="${y - 15}" 
              font-family="Arial, sans-serif" 
              font-size="${fontSize}" 
              fill="black" 
              font-weight="bold"
            >
              ${textContent}
            </text>
          `;

          // Append the text to the SVG
          $('svg').append(textNode);
        }
      }
    };

    // 3. Insert Data
    // We assume the paths have classes: .donorName and .donorAmount
    insertTextAbovePath('.donorName', donation.donorName, 32);
    insertTextAbovePath('.donorAmount', `$${donation.amount.toFixed(2)}`, 40);

    // 4. Convert the modified XML string to a Buffer
    const modifiedSvgBuffer = Buffer.from($.xml());

    // 5. Use Sharp to convert SVG Buffer -> PNG Buffer
    const pngBuffer = await sharp(modifiedSvgBuffer)
      .png() 
      .toBuffer();

    // 6. Send Email
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
          content: pngBuffer
        }
      ]
    });

    console.log(`Certificate sent to ${donation.donorEmail}`);

  } catch (error) {
    console.error("Automation Error:", error);
  }
};

module.exports = { generateAndEmail };