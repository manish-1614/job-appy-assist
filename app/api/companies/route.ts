import { NextResponse } from 'next/server';
import { loadCompanies, addCompany, toggleCompany, CompanyConfig } from '@/lib/storage';
import { detectAtsFromUrl } from '@/lib/ats-detector';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const companies = loadCompanies();
    return NextResponse.json({ success: true, companies });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { name, ats, slug, careersUrl, priority } = body;

    // Auto-detect ATS from careers URL if ats or slug is missing
    if (careersUrl && (!ats || !slug)) {
      const detected = await detectAtsFromUrl(careersUrl);
      if (detected) {
        ats = ats || detected.ats;
        slug = slug || detected.slug;
        name = name || detected.companyName;
      }
    }

    if (!name || !ats || !slug) {
      return NextResponse.json({ success: false, error: 'name, ats, and slug are required or could not be detected' }, { status: 400 });
    }

    const newCompany = addCompany({
      name,
      ats,
      slug,
      careersUrl: careersUrl || '',
      priority: priority || 2,
      isActive: true,
    });

    return NextResponse.json({ success: true, company: newCompany, message: `Company ${name} added to watchlist` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { companyId, isActive } = body;

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'companyId is required' }, { status: 400 });
    }

    const updated = toggleCompany(companyId, isActive);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, company: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
