import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateResumeDocx, generatePrintableHtml } from '@/lib/kit/export';
import { loadScreeningAnswers } from '@/lib/kit/tailor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kitId, format } = body;

    if (!kitId) {
      return NextResponse.json({ success: false, error: 'kitId is required' }, { status: 400 });
    }

    const kitPath = path.resolve(process.cwd(), 'data', 'kit', 'generated', `${kitId}.json`);
    if (!fs.existsSync(kitPath)) {
      return NextResponse.json({ success: false, error: 'Kit not found' }, { status: 404 });
    }

    const kit = JSON.parse(fs.readFileSync(kitPath, 'utf-8'));
    const answers = loadScreeningAnswers();
    const candidate = answers?.personal || {
      fullName: 'Manish Kumar Prajapati',
      email: 'mkprajapati@zohomail.in',
      phone: '+91 821-013-4128',
      location: 'India',
    };

    if (format === 'html') {
      const html = generatePrintableHtml(kit.tailoredResume, candidate);
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Default to docx
    const docxBuffer = await generateResumeDocx(kit.tailoredResume, candidate);
    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${candidate.fullName.replace(/\s+/g, '_')}_Resume.docx"`,
      },
    });
  } catch (err: any) {
    console.error('Error generating export:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to export document' },
      { status: 500 }
    );
  }
}
