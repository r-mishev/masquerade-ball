const Jimp = require('jimp');
const nodemailer = require('nodemailer');
const path = require('path');

// Configure GMAIL Transporter
const transporter = nodemailer.createTransport({
  host: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_PASSWORD // Use App Password if 2FA is on
  }
});

const generateAndEmail = async (donation) => {
  try {
    // 1. Load Image
    const fontName = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK); 
    const fontAmount = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK); // Larger for amount
    const image = await Jimp.read(path.join(__dirname, '../assets/Certificate of Donation.png'));

    // 2. Add Text (Adjust X, Y based on image_104a62.png)
    // Printing Name (Brown Rectangle Area)
    image.print(
      fontName, 
      100, // x-axis (pixels from left)
      400, // y-axis (pixels from top) - ADJUST THIS
      {
        text: donation.donorName,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
      },
      800, // max width
      100  // max height
    );

    // Printing Amount (Green Rectangle Area)
    image.print(
      fontAmount, 
      100, // x-axis
      600, // y-axis - ADJUST THIS
      {
        text: `$${donation.amount.toFixed(2)}`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
      },
      800, // max width
      100  // max height
    );

    // 3. Get Buffer
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

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
          content: buffer
        }
      ]
    });
    console.log(`Certificate sent to ${donation.donorEmail}`);

  } catch (error) {
    console.error("Automation Error:", error);
  }
};

module.exports = { generateAndEmail };