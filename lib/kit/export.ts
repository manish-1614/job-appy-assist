import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
} from 'docx';
import { BaseResumeVariant, CoverLetterDraft } from './types';
import { loadScreeningAnswers } from './tailor';

/**
 * Generate a clean, single-column ATS-compliant DOCX document from a tailored resume
 */
export async function generateResumeDocx(
  resume: BaseResumeVariant,
  candidateDetails: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    portfolioUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
  }
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 in
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: [
          // Header: Name
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: candidateDetails.fullName,
                bold: true,
                size: 32, // 16pt
                font: 'Calibri',
              }),
            ],
          }),

          // Header: Contact Info Line
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${candidateDetails.email} | ${candidateDetails.phone} | ${candidateDetails.location}`,
                size: 19, // 9.5pt
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${candidateDetails.portfolioUrl || ''} | ${candidateDetails.githubUrl || ''} | ${candidateDetails.linkedinUrl || ''}`,
                size: 18,
                font: 'Calibri',
                color: '333333',
              }),
            ],
            spacing: { after: 200 },
          }),

          // Professional Summary
          new Paragraph({
            text: 'PROFESSIONAL SUMMARY',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 160, after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: resume.summary,
                size: 20, // 10pt
                font: 'Calibri',
              }),
            ],
            spacing: { after: 180 },
          }),

          // Core Technical Skills
          new Paragraph({
            text: 'TECHNICAL SKILLS',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 160, after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: resume.skills.join(' • '),
                size: 20,
                font: 'Calibri',
              }),
            ],
            spacing: { after: 180 },
          }),

          // Professional Experience
          new Paragraph({
            text: 'PROFESSIONAL EXPERIENCE',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 160, after: 80 },
          }),

          ...resume.experience.flatMap((exp) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${exp.role} — ${exp.company}`,
                  bold: true,
                  size: 21,
                  font: 'Calibri',
                }),
                new TextRun({
                  text: `\t${exp.period}`,
                  italics: true,
                  size: 19,
                  font: 'Calibri',
                }),
              ],
              spacing: { before: 100, after: 40 },
            }),
            ...exp.bullets.map(
              (b) =>
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `• ${b.text}`,
                      size: 20,
                      font: 'Calibri',
                    }),
                  ],
                  spacing: { after: 40 },
                })
            ),
          ]),

          // Education
          new Paragraph({
            text: 'EDUCATION',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${resume.education.degree} — ${resume.education.institution}`,
                bold: true,
                size: 20,
                font: 'Calibri',
              }),
              new TextRun({
                text: ` (${resume.education.period})`,
                italics: true,
                size: 19,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: resume.education.details,
                size: 19,
                font: 'Calibri',
                color: '555555',
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * Generate printable HTML with embedded print stylesheet for browser "Print to PDF"
 */
export function generatePrintableHtml(
  resume: BaseResumeVariant,
  candidateDetails: any
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${candidateDetails.fullName} - Resume</title>
  <style>
    @page { margin: 0.5in; size: letter portrait; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.45;
      color: #111;
      background: #fff;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-size: 10.5pt;
    }
    h1 { font-size: 18pt; margin: 0 0 4px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; }
    .contact { text-align: center; font-size: 9pt; color: #444; margin-bottom: 16px; }
    .contact a { color: #111; text-decoration: none; }
    h2 { font-size: 11.5pt; text-transform: uppercase; border-bottom: 1px solid #111; padding-bottom: 2px; margin: 16px 0 8px 0; letter-spacing: 0.5px; }
    .role-header { display: flex; justify-content: space-between; font-weight: bold; margin-top: 10px; margin-bottom: 3px; }
    .role-title { font-size: 10.5pt; }
    .role-period { font-size: 9.5pt; color: #555; font-weight: normal; }
    ul { margin: 4px 0 10px 0; padding-left: 18px; }
    li { margin-bottom: 3px; text-align: justify; }
    .skills-block { font-size: 10pt; line-height: 1.5; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${candidateDetails.fullName}</h1>
  <div class="contact">
    ${candidateDetails.email} • ${candidateDetails.phone} • ${candidateDetails.location}<br>
    <a href="${candidateDetails.portfolioUrl}">Portfolio</a> • 
    <a href="${candidateDetails.githubUrl}">GitHub</a> • 
    <a href="${candidateDetails.linkedinUrl}">LinkedIn</a>
  </div>

  <h2>Professional Summary</h2>
  <p>${resume.summary}</p>

  <h2>Technical Core Skills</h2>
  <div class="skills-block">${resume.skills.join(' • ')}</div>

  <h2>Professional Experience</h2>
  ${resume.experience
    .map(
      (exp) => `
    <div class="role-header">
      <span class="role-title">${exp.role} — ${exp.company}</span>
      <span class="role-period">${exp.period}</span>
    </div>
    <ul>
      ${exp.bullets.map((b) => `<li>${b.text}</li>`).join('')}
    </ul>
  `
    )
    .join('')}

  <h2>Education</h2>
  <div class="role-header">
    <span class="role-title">${resume.education.degree} — ${resume.education.institution}</span>
    <span class="role-period">${resume.education.period}</span>
  </div>
  <p style="margin-top: 2px; font-size: 9.5pt; color: #555;">${resume.education.details}</p>
</body>
</html>`;
}

/**
 * Generate a Gmail compose URL or mailto link (Section 9.2: Never auto-send)
 */
export function generateGmailDraftUrl(params: {
  toEmail?: string;
  subject: string;
  body: string;
}): string {
  const recipient = params.toEmail ? encodeURIComponent(params.toEmail) : '';
  const subject = encodeURIComponent(params.subject);
  const body = encodeURIComponent(params.body);

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${body}`;
}
