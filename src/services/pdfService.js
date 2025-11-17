import PDFDocument from "pdfkit";

const buildPdfBuffer = (builder) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    builder(doc);
    doc.end();
  });

export const pdfService = {
  async generateReport({ title, sections = [], metadata = {} }) {
    return buildPdfBuffer((doc) => {
      doc.fontSize(20).text(title, { align: "center" });
      doc.moveDown();
      doc.fontSize(10).text(`Generated at: ${new Date().toLocaleString()}`);
      doc.moveDown();
      sections.forEach((section) => {
        doc.fontSize(14).text(section.heading, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).text(section.content || "", { align: "left" });
        doc.moveDown();
      });
      if (Object.keys(metadata).length) {
        doc.addPage();
        doc.fontSize(12).text("Metadata", { underline: true });
        doc.fontSize(10).text(JSON.stringify(metadata, null, 2));
      }
    });
  },

  async generateCertificate({ studentName, companyName, internshipTitle, credits }) {
    return buildPdfBuffer((doc) => {
      doc.fontSize(26).text("Certificate of Completion", { align: "center" });
      doc.moveDown(2);
      doc.fontSize(14).text(`This certifies that ${studentName}`, { align: "center" });
      doc.moveDown();
      doc.text(`has successfully completed the internship "${internshipTitle}" at ${companyName}.`, { align: "center" });
      doc.moveDown();
      doc.text(`Credits Earned: ${credits}`, { align: "center" });
      doc.moveDown(4);
      doc.text("__________________________", { align: "center" });
      doc.text("Prashiskshan Admin", { align: "center" });
    });
  },
};


