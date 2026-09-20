'use client';

import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Save, 
  Layers, 
  History,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { ApplicationRecord, ApplicationStatus, ApplicationChannel } from '@/lib/applications';

interface ApplicationDrawerWidgetProps {
  jobId: string;
  application: ApplicationRecord | null;
  onTrack: (jobId: string, status: ApplicationStatus, channel?: ApplicationChannel) => void;
  onUpdateStatus: (applicationId: string, status: ApplicationStatus, notes?: string) => void;
  onUpdateDetails: (applicationId: string, details: { channel?: ApplicationChannel; notes?: string }) => void;
}

export default function ApplicationDrawerWidget({
  jobId,
  application,
  onTrack,
  onUpdateStatus,
  onUpdateDetails,
}: ApplicationDrawerWidgetProps) {
  const [status, setStatus] = useState<ApplicationStatus>(application?.status || 'saved');
  const [channel, setChannel] = useState<ApplicationChannel>(application?.channel || 'direct');
  const [notes, setNotes] = useState<string>(application?.notes || '');
  const [events, setEvents] = useState<Array<{ id: number; eventType: string; createdAt: string; payload?: any }>>([]);
  const [isSavedNotes, setIsSavedNotes] = useState(false);

  useEffect(() => {
    if (application) {
      setStatus(application.status);
      setChannel(application.channel || 'direct');
      setNotes(application.notes || '');

      // Load events
      fetch(`/api/applications/${application.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.events) {
            setEvents(data.events);
          }
        })
        .catch((err) => console.warn('Failed to load application events:', err));
    } else {
      setStatus('saved');
      setChannel('direct');
      setNotes('');
      setEvents([]);
    }
  }, [application, jobId]);

  const handleStatusChange = (newStatus: ApplicationStatus) => {
    setStatus(newStatus);
    if (application) {
      onUpdateStatus(application.id, newStatus, notes);
    } else {
      onTrack(jobId, newStatus, channel);
    }
  };

  const handleSaveNotes = () => {
    if (application) {
      onUpdateDetails(application.id, { channel, notes });
      setIsSavedNotes(true);
      setTimeout(() => setIsSavedNotes(false), 2000);
    } else {
      onTrack(jobId, status, channel);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/80 border border-cyan-500/30 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Application Tracker
          </h4>
        </div>
        {application ? (
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
            Tracked: {application.status}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-slate-500">Not Tracked</span>
        )}
      </div>

      {/* QUICK STATUS ACTIONS IF NOT TRACKED */}
      {!application ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            One-click track this opening directly into your pipeline:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onTrack(jobId, 'applied', 'direct')}
              className="py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Applied (Direct)</span>
            </button>
            <button
              onClick={() => onTrack(jobId, 'applied', 'referral')}
              className="py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              <span>Mark Applied (Referral)</span>
            </button>
          </div>
          <button
            onClick={() => onTrack(jobId, 'saved')}
            className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-mono transition-all"
          >
            Save to Pipeline (Apply Later)
          </button>
        </div>
      ) : (
        /* TRACKED APPLICATION CONTROLS */
        <div className="space-y-3.5">
          {/* Status & Channel */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">
                Stage / Status
              </label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none capitalize"
              >
                <option value="saved">Saved</option>
                <option value="applied">Applied</option>
                <option value="screening">Screening</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="ghosted">Ghosted</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">
                Outreach Channel
              </label>
              <select
                value={channel}
                onChange={(e) => {
                  const newCh = e.target.value as ApplicationChannel;
                  setChannel(newCh);
                  onUpdateDetails(application.id, { channel: newCh, notes });
                }}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none capitalize"
              >
                <option value="direct">Direct ATS</option>
                <option value="referral">Referral</option>
                <option value="recruiter">Recruiter Inbound</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Follow-up reminder display */}
          {application.nextFollowUpAt && application.status !== 'accepted' && application.status !== 'rejected' && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Next Follow-up Due:</span>
              </div>
              <span className="font-bold">
                {new Date(application.nextFollowUpAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}

          {/* Notes textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                Application Notes &amp; Contacts
              </label>
              {isSavedNotes && (
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Spoke to Engineering Director John Doe; recruiter follow-up expected next Tuesday..."
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono"
            />
            <div className="mt-1.5 flex justify-end">
              <button
                onClick={handleSaveNotes}
                className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold transition-all flex items-center gap-1"
              >
                <Save className="w-3 h-3" />
                <span>Save Notes</span>
              </button>
            </div>
          </div>

          {/* Timeline Events Log */}
          {events.length > 0 && (
            <div className="pt-2 border-t border-white/5 space-y-1.5">
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 uppercase font-bold">
                <History className="w-3 h-3 text-slate-500" />
                <span>Event Timeline</span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {events.map((ev) => (
                  <div key={ev.id} className="text-[11px] font-mono text-slate-400 flex justify-between">
                    <span className="capitalize text-slate-300">
                      • {ev.eventType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-600">
                      {new Date(ev.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
