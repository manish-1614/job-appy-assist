import { NextRequest, NextResponse } from 'next/server';
import {
  getApplicationById,
  getApplicationEvents,
  updateApplicationStatus,
  deleteApplication,
  type ApplicationStatus,
} from '@/lib/applications';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const app = getApplicationById(params.id);
    if (!app) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    const events = getApplicationEvents(params.id);
    return NextResponse.json({ success: true, application: app, events });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to get application' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { status, notes, outcomeReason, channel, contacts, nextFollowUpAt } = body;

    const updated = updateApplicationStatus(params.id, status as ApplicationStatus, {
      notes,
      outcomeReason,
      channel,
      contacts,
      nextFollowUpAt,
    });

    return NextResponse.json({ success: true, application: updated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update application' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = deleteApplication(params.id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, deleted: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete application' },
      { status: 500 }
    );
  }
}
