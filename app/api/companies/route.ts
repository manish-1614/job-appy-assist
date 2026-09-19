import { NextResponse } from 'next/server';
import { loadCompanies, addCompany, toggleCompany, CompanyConfig } from '@/lib/storage';

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
    const { name, ats, slug, careersUrl, priority } = body;

    if (!name || !ats || !slug) {
      return NextResponse.json({ success: false, error: 'name, ats, and slug are required' }, { status: 400 });
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
