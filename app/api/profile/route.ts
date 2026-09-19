import { NextResponse } from 'next/server';
import { loadCandidateProfile, saveCandidateProfile, CandidateProfile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const profile = loadCandidateProfile();
    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const updatedProfile: CandidateProfile = await req.json();
    if (!updatedProfile || !updatedProfile.candidate) {
      return NextResponse.json({ success: false, error: 'Invalid profile data' }, { status: 400 });
    }
    saveCandidateProfile(updatedProfile);
    return NextResponse.json({ success: true, profile: updatedProfile, message: 'Profile updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
