'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, 
  Sparkles, 
  ShieldCheck, 
  Activity, 
  Building2, 
  Search, 
  ExternalLink, 
  X, 
  Zap, 
  CheckCircle2, 
  Clock, 
  Play,
  RefreshCw,
  Globe,
  FileText,
  ArrowLeft,
  History,
  Rss,
  Radio,
  AlertTriangle,
  GitMerge,
  PlusCircle,
  Send,
  Layers,
  UserCheck,
  Save,
  Check,
  Link as LinkIcon,
  BookmarkPlus,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Target,
  BarChart2,
  Flame
} from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/components/navigation/Sidebar';
import { EvaluatedJob, AtsType, RawJobPosting } from '@/lib/ats-adapters';
import { CompanyConfig, CandidateProfile } from '@/lib/storage';
import { AiEvaluationResult } from '@/lib/ai-evaluator';
import TodayCockpit from '@/components/tracker/TodayCockpit';
import PipelineKanban from '@/components/tracker/PipelineKanban';
import FunnelInsights from '@/components/tracker/FunnelInsights';
import ApplicationDrawerWidget from '@/components/tracker/ApplicationDrawerWidget';
import KitStudio from '@/components/kit/KitStudio';
import { ApplicationRecord, ApplicationStatus, ApplicationChannel } from '@/lib/applications';

export interface DistinctCompanyGroup {
  company: string;
  primaryJob: EvaluatedJob;
  otherJobs: EvaluatedJob[];
  totalJobsCount: number;
}

interface ScanHistoryItem {
  id: string;
  timestamp: string;
  totalRawJobsFetched: number;
  qualifyingJobsCount: number;
}

export default function Dashboard() {
  const [jobs, setJobs] = useState<EvaluatedJob[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'fresh' | 'all' | 'pipeline' | 'insights' | 'review' | 'watchlist' | 'profile' | 'runs'>('today');
  const [selectedJob, setSelectedJob] = useState<EvaluatedJob | null>(null);
  const [showKitModalJob, setShowKitModalJob] = useState<EvaluatedJob | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string>('Live Ingestion Ready');
  const [searchQuery, setSearchQuery] = useState('');
  const [totalFetchedCount, setTotalFetchedCount] = useState<number>(0);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);

  // Phase 3: Application Tracker, Today Cockpit, & Funnel Insights
  const [applicationsMap, setApplicationsMap] = useState<Record<string, ApplicationRecord>>({});
  const [applicationsList, setApplicationsList] = useState<ApplicationRecord[]>([]);
  const [todayData, setTodayData] = useState<any>(null);
  const [insightsData, setInsightsData] = useState<any>(null);

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications');
      const data = await res.json();
      if (data.success && Array.isArray(data.applications)) {
        setApplicationsList(data.applications);
        const map: Record<string, ApplicationRecord> = {};
        for (const app of data.applications) {
          map[app.jobId] = app;
        }
        setApplicationsMap(map);
      }
    } catch (e) {
      console.warn('Failed to load applications:', e);
    }
  };

  const fetchTodayData = async () => {
    try {
      const res = await fetch('/api/today');
      const data = await res.json();
      if (data.success) {
        setTodayData(data);
      }
    } catch (e) {
      console.warn('Failed to load today cockpit:', e);
    }
  };

  const fetchInsightsData = async () => {
    try {
      const res = await fetch('/api/insights');
      const data = await res.json();
      if (data.success && data.insights) {
        setInsightsData(data.insights);
      }
    } catch (e) {
      console.warn('Failed to load insights:', e);
    }
  };

  const handleTrackJob = async (jobId: string, status: ApplicationStatus = 'applied', channel: ApplicationChannel = 'direct') => {
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status, channel }),
      });
      const data = await res.json();
      if (data.success && data.application) {
        setApplicationsMap((prev) => ({ ...prev, [jobId]: data.application }));
        fetchApplications();
        fetchTodayData();
        fetchInsightsData();
      }
    } catch (err) {
      console.error('Failed to track job:', err);
    }
  };

  const handleUpdateAppStatus = async (applicationId: string, status: ApplicationStatus, notes?: string) => {
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      const data = await res.json();
      if (data.success && data.application) {
        setApplicationsMap((prev) => ({ ...prev, [data.application.jobId]: data.application }));
        fetchApplications();
        fetchTodayData();
        fetchInsightsData();
      }
    } catch (err) {
      console.error('Failed to update application status:', err);
    }
  };

  const handleUpdateAppDetails = async (applicationId: string, details: { channel?: ApplicationChannel; notes?: string }) => {
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
      const data = await res.json();
      if (data.success && data.application) {
        setApplicationsMap((prev) => ({ ...prev, [data.application.jobId]: data.application }));
        fetchApplications();
      }
    } catch (err) {
      console.error('Failed to update application details:', err);
    }
  };

  // Watchlist & Profile state
  const [companies, setCompanies] = useState<CompanyConfig[]>([]);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);

  // Add Company Form state
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyAts, setNewCompanyAts] = useState<AtsType>('greenhouse');
  const [newCompanySlug, setNewCompanySlug] = useState('');
  const [newCompanyUrl, setNewCompanyUrl] = useState('');
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);

  // Rate Limiting Cooldown State
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // History scan records state
  const [historyList, setHistoryList] = useState<ScanHistoryItem[]>([]);
  const [selectedHistoryScan, setSelectedHistoryScan] = useState<ScanHistoryItem | null>(null);


  // Distinct company accordion expansion state
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});
  const toggleCompanyExpand = (company: string) => {
    setExpandedCompanies((prev) => ({ ...prev, [company]: !prev[company] }));
  };

  // Phase 2: Calibration Labels & Tier Filter State
  const [jobLabels, setJobLabels] = useState<Record<string, { label: 'up' | 'down'; reasonCode?: string }>>({});
  const [tierFilter, setTierFilter] = useState<'all' | 'tier_a' | 'tier_b' | 'gated'>('all');
  const [activeReasonPickerJobId, setActiveReasonPickerJobId] = useState<string | null>(null);

  const fetchLabels = async () => {
    try {
      const res = await fetch('/api/labels');
      const data = await res.json();
      if (data.success && Array.isArray(data.labels)) {
        const map: Record<string, { label: 'up' | 'down'; reasonCode?: string }> = {};
        for (const l of data.labels) {
          map[l.jobId] = { label: l.label, reasonCode: l.reasonCode };
        }
        setJobLabels(map);
      }
    } catch (e) {
      console.warn('Failed to load labels:', e);
    }
  };

  const handleSaveLabel = async (jobId: string, label: 'up' | 'down', reasonCode: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setJobLabels((prev) => ({ ...prev, [jobId]: { label, reasonCode } }));
    setActiveReasonPickerJobId(null);
    try {
      await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, label, reasonCode }),
      });
    } catch (err) {
      console.error('Failed to post label:', err);
    }
  };


  // Load canonical jobs on mount
  const fetchCanonicalJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (data.success && Array.isArray(data.jobs) && data.jobs.length > 0) {
        setJobs(data.jobs);
        setTotalFetchedCount(data.count || data.jobs.length);
        setIsLiveMode(true);
      }
    } catch (e) {
      console.error('Failed to load canonical jobs:', e);
    }
  };

  // Load companies
  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      if (data.success && Array.isArray(data.companies)) {
        setCompanies(data.companies);
      }
    } catch (e) {
      console.error('Failed to load companies:', e);
    }
  };

  // Load candidate profile
  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.success && data.profile) {
        setProfile(data.profile);
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  };

  // Check rate limit on mount
  const checkRateLimitStatus = async () => {
    try {
      const res = await fetch('/api/scan/manual');
      const data = await res.json();
      if (data && typeof data.remainingSeconds === 'number' && data.remainingSeconds > 0) {
        setCooldownRemaining(data.remainingSeconds);
      }
    } catch (e) {
      console.error('Failed to check rate limit:', e);
    }
  };

  useEffect(() => {
    fetchCanonicalJobs();
    fetchCompanies();
    fetchProfile();
    checkRateLimitStatus();
    fetchLabels();
    fetchApplications();
    fetchTodayData();
    fetchInsightsData();

    // Check tab and scan query params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as any;
      if (tabParam && ['today', 'fresh', 'all', 'pipeline', 'insights', 'review', 'watchlist', 'profile', 'runs'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
      if (params.get('scan') === 'trigger') {
        triggerLiveScan();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Fetch scan history list on load
  const fetchScanHistory = async () => {
    try {
      const res = await fetch('/api/scans');
      const data = await res.json();
      if (data.success && Array.isArray(data.history) && data.history.length > 0) {
        setHistoryList(data.history);
        const lastScanDate = new Date(data.history[0].timestamp);
        const diffHours = Math.floor((Date.now() - lastScanDate.getTime()) / (1000 * 60 * 60));
        if (diffHours < 1) {
          const diffMins = Math.floor((Date.now() - lastScanDate.getTime()) / (1000 * 60));
          setLastScanTime(diffMins <= 0 ? 'Just now' : `${diffMins}m ago`);
        } else if (diffHours < 24) {
          setLastScanTime(`${diffHours}h ago`);
        } else {
          const diffDays = Math.floor(diffHours / 24);
          setLastScanTime(`${diffDays}d ago`);
        }
      }
    } catch (e) {
      console.error('Failed to load scan history:', e);
    }
  };

  useEffect(() => {
    fetchScanHistory();
  }, []);

  const formatCooldownTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Counts for Scorer v2 tiers
  const tierACount = useMemo(() => jobs.filter(j => j.tier === 'tier_a').length, [jobs]);
  const tierBCount = useMemo(() => jobs.filter(j => j.tier === 'tier_b').length, [jobs]);
  const gatedCount = useMemo(() => jobs.filter(j => j.tier === 'tier_c' || Boolean(j.gateReason)).length, [jobs]);

  // 1. Fresh Matches Tab Filter (Supports Tier A, Tier B, Gated)
  const freshJobs = jobs.filter(j => {
    const isTierMatched =
      tierFilter === 'all'
        ? (j.tier === 'tier_a' || j.tier === 'tier_b' || j.score >= 60)
        : tierFilter === 'tier_a'
        ? j.tier === 'tier_a'
        : tierFilter === 'tier_b'
        ? j.tier === 'tier_b'
        : (j.tier === 'tier_c' || Boolean(j.gateReason));

    return (
      (tierFilter === 'gated' ? true : j.status === 'open') &&
      isTierMatched &&
      (searchQuery === '' || 
        j.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        j.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.techStack.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
    );
  });

  // 2. Top Distinct Companies (Grouped by employer, ranked by relevance and tier)
  const topDistinctCompanies: DistinctCompanyGroup[] = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const map = new Map<string, { companyName: string; jobs: EvaluatedJob[] }>();

    for (const job of jobs) {
      if (tierFilter === 'tier_a' && job.tier !== 'tier_a') continue;
      if (tierFilter === 'tier_b' && job.tier !== 'tier_b') continue;
      if (tierFilter === 'gated' && job.tier !== 'tier_c' && !job.gateReason) continue;
      if (tierFilter === 'all' && job.tier === 'tier_c' && job.score < 60) continue;
      if (tierFilter !== 'gated' && job.status !== 'open') continue;

      const matchesSearch =
        query === '' ||
        job.title.toLowerCase().includes(query) ||
        job.company.toLowerCase().includes(query) ||
        job.techStack.some((t) => t.toLowerCase().includes(query));

      if (!matchesSearch) continue;

      const key = (job.company || 'Unknown').trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { companyName: job.company, jobs: [] });
      }
      map.get(key)!.jobs.push(job);
    }

    const groups: DistinctCompanyGroup[] = [];
    for (const grp of Array.from(map.values())) {
      grp.jobs.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.firstSeenAt || 0).getTime() - new Date(a.firstSeenAt || 0).getTime();
      });
      groups.push({
        company: grp.companyName,
        primaryJob: grp.jobs[0],
        otherJobs: grp.jobs.slice(1),
        totalJobsCount: grp.jobs.length,
      });
    }

    groups.sort((a, b) => {
      if (b.primaryJob.score !== a.primaryJob.score) return b.primaryJob.score - a.primaryJob.score;
      return new Date(b.primaryJob.firstSeenAt || 0).getTime() - new Date(a.primaryJob.firstSeenAt || 0).getTime();
    });

    return groups.slice(0, 50);
  }, [jobs, searchQuery, tierFilter]);

  // All active jobs count for reference
  const allActiveJobs = jobs.filter(j => j.status === 'open');

  // 3. Review Queue Tab Filter (Possible Duplicates & Score 55-69)
  const reviewJobs = jobs.filter(j => 
    (j.status === 'possible_duplicate' || (j.score >= 55 && j.score < 70 && j.status === 'open')) &&
    (searchQuery === '' || 
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      j.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const triggerLiveScan = async () => {
    if (cooldownRemaining > 0) return;

    setIsScanning(true);
    setTelegramStatus(null);
    try {
      const res = await fetch('/api/scan/manual', { method: 'POST' });
      const data = await res.json();

      if (res.status === 429) {
        alert(data.error || 'Rate limit active. Please wait 5 minutes between manual triggers.');
        setCooldownRemaining(data.remainingSeconds || 300);
        return;
      }

      if (data.success && Array.isArray(data.jobs) && data.jobs.length > 0) {
        setJobs(data.jobs);
        setIsLiveMode(true);
        setSelectedHistoryScan(null);
        setTotalFetchedCount(data.totalRawJobsFetched);
        setCooldownRemaining(300);
        const dateObj = new Date(data.scannedAt);
        setLastScanTime(`${dateObj.toLocaleTimeString()} IST Live`);

        if (data.telegramNotification) {
          const tg = data.telegramNotification;
          if (tg.freshRolesCount > 0) {
            setTelegramStatus(`🚀 Telegram Digest Sent: ${tg.freshRolesCount} Fresh Role(s) Alerted (${tg.isMock ? 'Mock' : 'Live'})`);
          } else {
            setTelegramStatus(`🛡️ Telegram Digest Sent: 0 New Roles (Health Summary Report Dispatched)`);
          }
        }

        fetchScanHistory();
      }
    } catch (err) {
      console.error('Failed to run live scan:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleReviewAction = async (job: EvaluatedJob, action: 'merge' | 'confirm_distinct' | 'add_watchlist') => {
    try {
      const res = await fetch('/api/review/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          jobId: job.id,
          targetJobId: job.possibleDuplicateOf?.matchedJobId,
          companyName: job.company,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(`✅ Action Completed: ${data.message}`);
        fetchCanonicalJobs();
        fetchCompanies();
      }
    } catch (err) {
      console.error('Error resolving review action:', err);
    }
  };

  const toggleCompanyActive = async (companyId: string, currentActive: boolean) => {
    try {
      const res = await fetch('/api/companies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, isActive: !currentActive })
      });
      const data = await res.json();
      if (data.success) {
        fetchCompanies();
      }
    } catch (e) {
      console.error('Failed to toggle company:', e);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName || !newCompanySlug) return;
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCompanyName,
          ats: newCompanyAts,
          slug: newCompanySlug,
          careersUrl: newCompanyUrl
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddCompanyModal(false);
        setNewCompanyName('');
        setNewCompanySlug('');
        setNewCompanyUrl('');
        fetchCompanies();
      } else {
        alert(data.error || 'Failed to add company');
      }
    } catch (err) {
      console.error('Error adding company:', err);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      const data = await res.json();
      if (data.success) {
        setProfileSavedMsg(true);
        setTimeout(() => setProfileSavedMsg(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save profile:', e);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const loadHistoricalScanRecord = async (scan: ScanHistoryItem) => {
    try {
      const res = await fetch(`/api/scans/${scan.id}`);
      const data = await res.json();
      if (data.success && data.scan && Array.isArray(data.scan.jobs)) {
        setJobs(data.scan.jobs);
        setSelectedHistoryScan(scan);
        setTotalFetchedCount(data.scan.totalRawJobsFetched || 0);
        setLastScanTime(`${new Date(scan.timestamp).toLocaleTimeString()} IST (Archived)`);
        setActiveTab('fresh');
      }
    } catch (e) {
      console.error('Failed to load scan record:', e);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#060B08] text-emerald-50 overflow-hidden font-sans">
      
      {/* REUSABLE FROSTED GLASS SIDEBAR */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        todayDueCount={todayData?.followUpsDue?.length || 0}
        freshJobsCount={freshJobs.length}
        topCompaniesCount={topDistinctCompanies.length}
        pipelineCount={applicationsList.length}
        responseRate={insightsData ? insightsData.responseRate : 0}
        reviewCount={reviewJobs.length}
        companiesCount={companies.length}
        historyCount={historyList.length}
        isScanning={isScanning}
        cooldownRemaining={cooldownRemaining}
        onTriggerLiveScan={triggerLiveScan}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col gap-6 p-8 overflow-y-auto max-w-6xl">
        
        {/* Top Bar Header */}
        <header className="glass-panel p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {activeTab === 'fresh' && 'Fresh Job Openings (Last 24 Hours / 2 Scans)'}
                {activeTab === 'all' && 'Top 50 Distinct Company Openings (Relevance Ranked)'}
                {activeTab === 'review' && 'Review Queue (Possible Duplicates & Review Fits)'}
                {activeTab === 'watchlist' && 'Employer Watchlist & ATS Feeds'}
                {activeTab === 'profile' && 'Candidate Profile & AI Matching Criteria'}
                {activeTab === 'runs' && 'Scan Run Diagnostics & Telegram History'}
              </h2>
              {isLiveMode && (
                <span className="flex items-center gap-1.5 text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full animate-pulse">
                  <Radio className="w-3 h-3" /> LIVE CANONICAL DATA
                </span>
              )}
              {selectedHistoryScan && (
                <span className="flex items-center gap-1.5 text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full">
                  <History className="w-3 h-3" /> ARCHIVE: {selectedHistoryScan.id}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Calibrated for Manish Kumar Prajapati (~8.5 yrs exp, Distributed Systems, CRM SaaS, AI Agents).
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== 'profile' && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search title, company, tech..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900/60 border border-white/10 rounded-2xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-64 transition-all"
                />
              </div>
            )}
          </div>
        </header>

        {/* Telegram Digest Status Banner */}
        {telegramStatus && (
          <div className="glass-panel p-4 border border-cyan-500/40 bg-cyan-950/30 text-cyan-200 rounded-2xl flex items-center justify-between text-sm shadow-glow-cyan">
            <div className="flex items-center gap-3">
              <Send className="w-5 h-5 text-cyan-400" />
              <span>{telegramStatus}</span>
            </div>
            <button onClick={() => setTelegramStatus(null)} className="text-cyan-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


        {/* METRICS ROW (Scorer v2) */}
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-panel p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Tier A (Top Fit)</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{tierACount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shadow-glow-cyan">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-panel p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Tier B (Qualifying)</span>
              <div className="text-2xl font-bold text-cyan-400 mt-1 font-mono">{tierBCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-panel p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Gated / Excluded</span>
              <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{gatedCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-panel p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Last Scan Status</span>
              <div className="text-sm font-semibold text-emerald-400 mt-1 font-mono truncate max-w-[130px]">{lastScanTime}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* CONTENT TAB 0: TODAY COCKPIT (Phase 3) */}
        {activeTab === 'today' && (
          <TodayCockpit
            todayData={todayData}
            onSelectJobId={(jobId) => {
              const j = jobs.find((x) => x.id === jobId);
              if (j) setSelectedJob(j);
            }}
            onTrackJob={(jobId, status) => handleTrackJob(jobId, status)}
            onAdvanceStatus={(appId, status) => handleUpdateAppStatus(appId, status)}
          />
        )}

        {/* TIER FILTER BAR (Scorer v2) - Shown on job browsing tabs */}
        {(activeTab === 'fresh' || activeTab === 'all') && (
          <div className="flex items-center justify-between bg-slate-900/50 p-2.5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-400 px-3 uppercase font-bold">Scorer v2 Tiers:</span>
              <button
                onClick={() => setTierFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                  tierFilter === 'all'
                    ? 'bg-white/10 text-white font-bold border border-white/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Qualifying ({jobs.length - gatedCount})
              </button>
              <button
                onClick={() => setTierFilter('tier_a')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                  tierFilter === 'tier_a'
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-glow-cyan'
                    : 'text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Tier A Top Fit ({tierACount})</span>
              </button>
              <button
                onClick={() => setTierFilter('tier_b')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                  tierFilter === 'tier_b'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-cyan-400 hover:bg-cyan-500/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span>Tier B ({tierBCount})</span>
              </button>
              <button
                onClick={() => setTierFilter('gated')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                  tierFilter === 'gated'
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Gated ({gatedCount})</span>
              </button>
            </div>
            <div className="text-[11px] font-mono text-slate-500 pr-3 hidden sm:block">
              Deterministic Gates (D1-D8) Active
            </div>
          </div>
        )}

        {/* CONTENT TAB 1: FRESH MATCHES */}
        {activeTab === 'fresh' && (
          <div className="space-y-4">
            {freshJobs.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-3xl">
                <Sparkles className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">No New Qualifying Roles in the Last 24 Hours</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                  Trigger a live scan to ingest latest postings across Ashby, Greenhouse, Lever, and RSS feeds.
                </p>
              </div>
            ) : (
              freshJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="glass-panel p-6 rounded-3xl cursor-pointer hover:border-cyan-500/50 hover:bg-slate-900/60 transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                          {job.source}
                        </span>
                        {job.tier === 'tier_a' && (
                          <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full shadow-glow-cyan">
                            TIER A (TOP FIT)
                          </span>
                        )}
                        {job.tier === 'tier_b' && (
                          <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full">
                            TIER B
                          </span>
                        )}
                        {job.gateReason && (
                          <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            {job.gateReason}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">{job.company}</span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-400">{job.location}</span>
                      </div>
                      <h3 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {job.title}
                      </h3>
                      <p className="text-sm text-slate-300 mt-2 line-clamp-2 max-w-3xl">
                        {job.matchReason}
                      </p>
                    </div>

                    <div className="flex flex-col items-end shrink-0 pl-4">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-bold font-mono ${job.tier === 'tier_a' ? 'text-emerald-400' : 'text-white'}`}>{job.score}</span>
                        <span className="text-xs text-slate-500 font-mono">/100</span>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 mt-1 capitalize">
                        {job.sponsorship} Sponsorship
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {job.techStack.map((tech) => (
                        <span key={tech} className="text-xs px-2.5 py-1 rounded-xl bg-white/5 text-slate-300 border border-white/5">
                          {tech}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Thumbs Feedback */}
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleSaveLabel(job.id, 'up', 'good_match', e)}
                          title="Thumbs Up (Good Match)"
                          className={`p-1.5 rounded-xl border text-xs transition-all flex items-center gap-1 ${
                            jobLabels[job.id]?.label === 'up'
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-glow-cyan'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>

                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReasonPickerJobId(activeReasonPickerJobId === job.id ? null : job.id);
                            }}
                            title="Thumbs Down (Reject with Reason)"
                            className={`p-1.5 rounded-xl border text-xs transition-all flex items-center gap-1 ${
                              jobLabels[job.id]?.label === 'down'
                                ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>

                          {activeReasonPickerJobId === job.id && (
                            <div className="absolute right-0 bottom-full mb-2 w-52 bg-slate-900 border border-white/15 rounded-xl shadow-2xl p-2 z-40 space-y-1 text-left">
                              <div className="text-[10px] font-mono text-slate-400 px-2 py-1 border-b border-white/10 font-bold">
                                Downvote Reason:
                              </div>
                              {[
                                { code: 'bad_stack', label: 'Bad Tech Stack' },
                                { code: 'not_remote', label: 'Not Remote in India' },
                                { code: 'bad_location', label: 'Ineligible Location' },
                                { code: 'overqualified', label: 'Overqualified' },
                                { code: 'underqualified', label: 'Underqualified' },
                                { code: 'low_comp', label: 'Low Compensation' },
                                { code: 'presales_heavy', label: 'Heavy Pre-sales' },
                                { code: 'other', label: 'Other' },
                              ].map((r) => (
                                <button
                                  key={r.code}
                                  onClick={(e) => handleSaveLabel(job.id, 'down', r.code, e)}
                                  className="w-full text-left px-2 py-1 rounded-lg text-xs text-slate-300 hover:bg-rose-500/20 hover:text-rose-200 transition-colors block"
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* One-Click Track Actions (Phase 3) */}
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {applicationsMap[job.id] ? (
                          <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            {applicationsMap[job.id].status}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTrackJob(job.id, 'applied');
                              }}
                              title="One-Click Mark Applied"
                              className="px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold transition-all flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Applied</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTrackJob(job.id, 'saved');
                              }}
                              title="Save to Pipeline"
                              className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-mono transition-all"
                            >
                              Save
                            </button>
                          </div>
                        )}
                      </div>

                      <span className="text-xs font-mono text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Inspect Breakdown →
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* CONTENT TAB 2: TOP 50 DISTINCT COMPANIES */}
        {activeTab === 'all' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-mono">
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                Showing Top {topDistinctCompanies.length} Distinct Employers (Ranked by Candidate Relevance, Min Score 65)
              </span>
              <span className="font-mono text-purple-300">
                1 Primary Role per Employer + Expandable Openings
              </span>
            </div>

            {topDistinctCompanies.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-3xl">
                <Building2 className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">No Distinct Company Openings Matching Criteria</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                  Trigger a live scan or adjust your search filter to discover relevant openings across tracked employers.
                </p>
              </div>
            ) : (
              topDistinctCompanies.map((group, index) => {
                const isExpanded = Boolean(expandedCompanies[group.company]);
                const job = group.primaryJob;

                return (
                  <div
                    key={group.company}
                    className="glass-panel p-6 rounded-3xl border border-white/10 hover:border-purple-500/40 transition-all duration-300 space-y-4"
                  >
                    {/* Primary Company & Role Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded-lg">
                            #{index + 1}
                          </span>
                          <span className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-purple-400" />
                            {group.company}
                          </span>
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-xs font-mono text-slate-400">{job.source}</span>
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-xs text-slate-400">{job.location}</span>
                        </div>

                        <h4 
                          onClick={() => setSelectedJob(job)}
                          className="text-lg font-bold text-white hover:text-cyan-300 cursor-pointer transition-colors flex items-center gap-2"
                        >
                          {job.title}
                          <span className="text-xs font-normal text-slate-500 hover:text-slate-300">
                            (Inspect Breakdown →)
                          </span>
                        </h4>

                        <p className="text-xs text-slate-300 line-clamp-2 max-w-3xl leading-relaxed">
                          {job.matchReason}
                        </p>
                      </div>

                      {/* Score Gauge */}
                      <div className="flex flex-col items-end shrink-0 bg-slate-900/60 p-3 rounded-2xl border border-white/5 min-w-[120px] text-right">
                        <div className="flex items-baseline gap-1">
                          <span className={`text-2xl font-bold font-mono ${
                            job.score >= 70 ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {job.score}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">/100</span>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full mt-1 border capitalize ${
                          job.score >= 70 
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {job.sponsorship} Sponsorship
                        </span>
                      </div>
                    </div>

                    {/* Tech Stack & Primary Action */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5 flex-wrap gap-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {job.techStack.map((tech) => (
                          <span key={tech} className="text-xs px-2.5 py-1 rounded-xl bg-white/5 text-slate-300 border border-white/5 font-mono">
                            {tech}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        {group.otherJobs.length > 0 && (
                          <button
                            onClick={() => toggleCompanyExpand(group.company)}
                            className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
                          >
                            <span>+{group.otherJobs.length} other opening{group.otherJobs.length > 1 ? 's' : ''}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        <a
                          href={job.canonicalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-glow-cyan transition-all"
                        >
                          <span>Apply Directly ↗</span>
                        </a>
                      </div>
                    </div>

                    {/* Secondary Roles Accordion */}
                    {isExpanded && group.otherJobs.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-purple-500/20 space-y-2 bg-purple-950/20 p-4 rounded-2xl animate-in fade-in duration-200">
                        <span className="text-xs font-mono text-purple-300 uppercase tracking-wider block font-semibold mb-2">
                          Other Qualifying Openings at {group.company}
                        </span>
                        <div className="space-y-2">
                          {group.otherJobs.map((otherJob) => (
                            <div
                              key={otherJob.id}
                              className="p-3 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between hover:border-purple-500/30 transition-all"
                            >
                              <div className="space-y-0.5">
                                <h5 
                                  onClick={() => setSelectedJob(otherJob)}
                                  className="text-sm font-semibold text-white hover:text-cyan-300 cursor-pointer transition-colors"
                                >
                                  {otherJob.title}
                                </h5>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  <span>{otherJob.location}</span>
                                  <span>•</span>
                                  <span className="font-mono text-cyan-400">{otherJob.techStack.slice(0, 3).join(', ')}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <span className="font-mono font-bold text-sm text-white">{otherJob.score}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">/100</span>
                                </div>

                                <button
                                  onClick={() => setSelectedJob(otherJob)}
                                  className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                                >
                                  Inspect
                                </button>

                                <a
                                  href={otherJob.canonicalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs px-3 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 flex items-center gap-1"
                                >
                                  <span>Apply</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* CONTENT TAB: PIPELINE KANBAN (Phase 3) */}
        {activeTab === 'pipeline' && (
          <PipelineKanban
            applications={applicationsList}
            onSelectJobId={(jobId) => {
              const j = jobs.find((x) => x.id === jobId);
              if (j) setSelectedJob(j);
            }}
            onAdvanceStatus={(appId, status) => handleUpdateAppStatus(appId, status)}
          />
        )}

        {/* CONTENT TAB: FUNNEL INSIGHTS (Phase 3) */}
        {activeTab === 'insights' && (
          <FunnelInsights insights={insightsData} />
        )}

        {/* CONTENT TAB 3: REVIEW QUEUE */}
        {activeTab === 'review' && (
          <div className="space-y-4">
            {reviewJobs.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-3xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">Review Queue is Clean</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                  No duplicate collisions or borderline roles requiring candidate resolution.
                </p>
              </div>
            ) : (
              reviewJobs.map((job) => (
                <div key={job.id} className="glass-panel p-6 rounded-3xl border-amber-500/30 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                          {job.status === 'possible_duplicate' ? '⚠️ Possible Duplicate' : 'Review Match (55-69)'}
                        </span>
                        <span className="text-xs text-slate-400">{job.company}</span>
                      </div>
                      <h4 className="text-lg font-bold text-white mt-1">{job.title}</h4>
                      <p className="text-xs text-amber-200/80 mt-1">
                        {job.possibleDuplicateOf?.reason || job.matchReason}
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs text-slate-400">
                      Score: <strong className="text-white text-sm">{job.score}</strong>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center gap-3">
                    <button
                      onClick={() => handleReviewAction(job, 'merge')}
                      className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      Merge with Existing Job
                    </button>

                    <button
                      onClick={() => handleReviewAction(job, 'confirm_distinct')}
                      className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirm as Distinct
                    </button>

                    <button
                      onClick={() => handleReviewAction(job, 'add_watchlist')}
                      className="px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Add to Watchlist
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* CONTENT TAB 4: WATCHLIST */}
        {activeTab === 'watchlist' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-lg">Direct ATS & RSS Employer Sources</h3>
                <p className="text-xs text-slate-400 mt-0.5">Polite public JSON API adapters avoiding web scraping.</p>
              </div>
              <button
                onClick={() => setShowAddCompanyModal(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-magenta-500 text-white text-xs font-semibold flex items-center gap-2 shadow-glow-cyan"
              >
                <PlusCircle className="w-4 h-4" />
                Add Employer Source
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {companies.map((co) => (
                <div key={co.id || co.slug} className="glass-panel p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white flex items-center gap-2">
                      {co.name}
                      {co.careersUrl && (
                        <a href={co.careersUrl} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-cyan-400">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </h4>
                    <span className="text-xs font-mono text-cyan-400 uppercase">
                      {co.ats} • slug: {co.slug.slice(0, 30)}
                    </span>
                  </div>

                  <button
                    onClick={() => toggleCompanyActive(co.id, co.isActive)}
                    className={`text-xs px-3 py-1 rounded-full font-mono transition-all ${
                      co.isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    {co.isActive ? 'Active' : 'Paused'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTENT TAB 5: CANDIDATE PROFILE */}
        {activeTab === 'profile' && profile && (
          <div className="glass-panel p-8 rounded-3xl space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-white/10">
              <div>
                <h3 className="text-2xl font-bold text-white">{profile.candidate.name}</h3>
                <p className="text-sm text-cyan-400 font-mono mt-1">{profile.candidate.headline}</p>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                  <span>{profile.candidate.currentTitle} at {profile.candidate.currentCompany}</span>
                  <span>•</span>
                  <span>{profile.candidate.yearsOfExperience} Years Experience</span>
                  <span>•</span>
                  <span>{profile.candidate.education}</span>
                </div>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-glow-cyan"
              >
                {profileSavedMsg ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{profileSavedMsg ? 'Saved!' : 'Save Changes'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-mono text-slate-300 uppercase tracking-wider">Target Role Titles</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.targetRoles.map((role, idx) => (
                    <span key={idx} className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-cyan-300 font-medium">
                      {role}
                    </span>
                  ))}
                </div>

                <h4 className="text-sm font-mono text-slate-300 uppercase tracking-wider pt-4">Core Tech Stack</h4>
                <div className="space-y-2 text-xs">
                  <p><strong className="text-slate-400">Languages:</strong> {profile.coreSkills.languages.map(s => typeof s === 'string' ? s : s.name).join(', ')}</p>
                  <p><strong className="text-slate-400">Backend & Distributed:</strong> {profile.coreSkills.backendAndDistributed.map(s => typeof s === 'string' ? s : s.name).join(', ')}</p>
                  <p><strong className="text-slate-400">AI & Workflow Automation:</strong> {profile.coreSkills.aiAndWorkflowAutomation.map(s => typeof s === 'string' ? s : s.name).join(', ')}</p>
                  <p><strong className="text-slate-400">Databases:</strong> {profile.coreSkills.databases.map(s => typeof s === 'string' ? s : s.name).join(', ')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-mono text-slate-300 uppercase tracking-wider">Highlighted Architectures</h4>
                {profile.highlightedProjects.map((p, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/5 text-xs">
                    <strong className="text-white text-sm block mb-1">{p.name}</strong>
                    <p className="text-slate-400 leading-relaxed">{p.summary}</p>
                  </div>
                ))}

                <h4 className="text-sm font-mono text-slate-300 uppercase tracking-wider pt-2">Preferences & Dealbreakers</h4>
                <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs space-y-1">
                  <p><strong className="text-cyan-300">Target Locations:</strong> {profile.preferences.workMode.join(', ')}</p>
                  <p><strong className="text-cyan-300">Relocation Targets:</strong> {profile.preferences.relocationTargetCountries.join(', ')}</p>
                  <p><strong className="text-cyan-300">Target Compensation:</strong> {profile.preferences.targetSalaryInrLakhs} (Min INR {profile.preferences.minimumSalaryInrLakhs}L)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT TAB 6: SCAN HISTORY RUNS */}
        {activeTab === 'runs' && (
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <h3 className="font-bold text-white text-lg">Scan Execution Records</h3>
            {historyList.length === 0 ? (
              <p className="text-sm text-slate-500">No previous scan files recorded.</p>
            ) : (
              <div className="space-y-2">
                {historyList.map((item) => (
                  <div key={item.id} className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm text-cyan-300">{item.id}</div>
                      <div className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-xs">
                        <div className="text-white font-bold">{item.qualifyingJobsCount} Qualifying</div>
                        <div className="text-slate-500">{item.totalRawJobsFetched} raw fetched</div>
                      </div>
                      <button
                        onClick={() => loadHistoricalScanRecord(item)}
                        className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-mono border border-purple-500/30"
                      >
                        Load Record
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* DETAIL SIDE DRAWER */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-[520px] h-full glass-panel border-l border-white/10 p-8 overflow-y-auto flex flex-col justify-between shadow-2xl">
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                  {selectedJob.source}
                </span>
                <button onClick={() => setSelectedJob(null)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">{selectedJob.title}</h2>
                <p className="text-base text-slate-300 mt-1 font-medium">{selectedJob.company}</p>
                <p className="text-xs text-slate-500 mt-0.5">{selectedJob.location}</p>
              </div>

              {/* SCORER V2 DETERMINISTIC FIT & TIER */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/50 to-purple-950/50 border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-mono tracking-wider">SCORER V2 DETERMINISTIC FIT</span>
                    <div className="text-3xl font-bold text-white font-mono mt-0.5">{selectedJob.score}/100</div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-mono font-bold border ${
                    selectedJob.tier === 'tier_a'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-glow-cyan'
                      : selectedJob.tier === 'tier_b'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    {selectedJob.tier === 'tier_a' ? 'TIER A (TOP FIT)' : selectedJob.tier === 'tier_b' ? 'TIER B (QUALIFYING)' : selectedJob.gateReason || 'TIER C / GATED'}
                  </span>
                </div>

                {/* Gates Status Checklist */}
                <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Role & Seniority</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    {selectedJob.gateReason?.includes('region_locked') || selectedJob.gateReason?.includes('onsite_elsewhere') ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span className="truncate">Class: {selectedJob.locationClass || 'eligible'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Floor: ≥25L INR</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="capitalize">{selectedJob.sponsorship} Sponsorship</span>
                  </div>
                </div>
              </div>

              {/* DETERMINISTIC SUB-SCORES BREAKDOWN */}
              {selectedJob.subScores && (
                <div className="space-y-2">
                  <h4 className="text-xs font-mono text-cyan-400 tracking-wider uppercase font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Deterministic Sub-Scores Breakdown</span>
                  </h4>
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-2.5 text-xs font-mono">
                    {[
                      { name: 'Role Fit', weight: '30%', score: selectedJob.subScores.roleFit },
                      { name: 'Stack Overlap', weight: '20%', score: selectedJob.subScores.stackOverlap },
                      { name: 'Reachability', weight: '15%', score: selectedJob.subScores.reachability },
                      { name: 'Domain Affinity', weight: '10%', score: selectedJob.subScores.domainAffinity },
                      { name: 'Freshness', weight: '10%', score: selectedJob.subScores.freshness },
                      { name: 'Comp Fit', weight: '10%', score: selectedJob.subScores.compFit },
                      { name: 'Company Signal', weight: '5%', score: selectedJob.subScores.companySignal },
                    ].map((s) => (
                      <div key={s.name} className="space-y-1">
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>{s.name} ({s.weight})</span>
                          <span className="text-white font-bold">{Math.round((s.score || 0) * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                            style={{ width: `${Math.round((s.score || 0) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* APPLICATION TRACKER WIDGET (Phase 3) */}
              <ApplicationDrawerWidget
                jobId={selectedJob.id}
                application={applicationsMap[selectedJob.id] || null}
                onTrack={(jobId, status, channel) => handleTrackJob(jobId, status, channel)}
                onUpdateStatus={(appId, status, notes) => handleUpdateAppStatus(appId, status, notes)}
                onUpdateDetails={(appId, details) => handleUpdateAppDetails(appId, details)}
              />

              {/* APPLICATION KIT STUDIO BUTTON (Phase 4) */}
              <button
                onClick={() => setShowKitModalJob(selectedJob)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-glow-emerald transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Tailor Application Kit (Resume &amp; Cover Letter) ↗</span>
              </button>

              {/* CALIBRATION FEEDBACK WIDGET */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-300 font-bold">USER CALIBRATION RATING</span>
                  {jobLabels[selectedJob.id] && (
                    <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                      Labeled: {jobLabels[selectedJob.id].label === 'up' ? '👍 Good' : `👎 ${jobLabels[selectedJob.id].reasonCode}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSaveLabel(selectedJob.id, 'up', 'good_match')}
                    className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      jobLabels[selectedJob.id]?.label === 'up'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-glow-cyan'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>Good Match</span>
                  </button>

                  <button
                    onClick={() => setActiveReasonPickerJobId(activeReasonPickerJobId === selectedJob.id ? null : selectedJob.id)}
                    className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      jobLabels[selectedJob.id]?.label === 'down'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <span>Reject...</span>
                  </button>
                </div>

                {activeReasonPickerJobId === selectedJob.id && (
                  <div className="p-3 bg-slate-900 border border-white/15 rounded-xl space-y-1 text-left animate-in fade-in duration-150">
                    <div className="text-[10px] font-mono text-slate-400 pb-1 border-b border-white/10 font-bold">
                      Select Rejection Reason:
                    </div>
                    {[
                      { code: 'bad_stack', label: 'Bad Tech Stack' },
                      { code: 'not_remote', label: 'Not Remote in India' },
                      { code: 'bad_location', label: 'Ineligible Location' },
                      { code: 'overqualified', label: 'Overqualified' },
                      { code: 'underqualified', label: 'Underqualified' },
                      { code: 'low_comp', label: 'Low Compensation' },
                      { code: 'presales_heavy', label: 'Heavy Pre-sales' },
                      { code: 'other', label: 'Other' },
                    ].map((r) => (
                      <button
                        key={r.code}
                        onClick={() => handleSaveLabel(selectedJob.id, 'down', r.code)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-rose-500/20 hover:text-rose-200 transition-colors block"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono text-slate-400 tracking-wider">MATCH RATIONALE</h4>
                <p className="text-sm text-slate-200 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5">
                  {selectedJob.matchReason}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono text-slate-400 tracking-wider">ZERO-FABRICATION AUDIT EVIDENCE</h4>
                <ul className="space-y-2">
                  {selectedJob.evidence.map((ev, index) => (
                    <li key={index} className="text-xs text-slate-300 flex items-start gap-2 bg-white/5 p-3 rounded-xl">
                      <span className="text-cyan-400 mt-0.5">•</span>
                      <span>{ev}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono text-slate-400 tracking-wider">DETECTED TECH STACK</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.techStack.map((tech) => (
                    <span key={tech} className="text-xs px-3 py-1 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6">
              <a
                href={selectedJob.canonicalUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-glow-emerald hover:opacity-95 transition-opacity"
              >
                <span>Apply Directly at Employer ATS</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ADD COMPANY MODAL */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-[480px] p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add Employer Source</h3>
              <button onClick={() => setShowAddCompanyModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Linear"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">ATS Platform</label>
                <select
                  value={newCompanyAts}
                  onChange={(e) => setNewCompanyAts(e.target.value as AtsType)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="ashby">Ashby</option>
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                  <option value="smartrecruiters">SmartRecruiters</option>
                  <option value="rss">RSS Feed</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Slug / Board ID / Feed URL</label>
                <input
                  type="text"
                  placeholder="e.g. linear or stripe"
                  value={newCompanySlug}
                  onChange={(e) => setNewCompanySlug(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Careers URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://linear.app/careers"
                  value={newCompanyUrl}
                  onChange={(e) => setNewCompanyUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-semibold shadow-glow-emerald"
                >
                  Save Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kit Studio Modal */}
      {showKitModalJob && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[92vh] bg-slate-950 border border-white/15 rounded-3xl p-6 overflow-y-auto relative shadow-2xl space-y-4">
            <button
              onClick={() => setShowKitModalJob(null)}
              className="absolute right-5 top-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <KitStudio
              jobId={showKitModalJob.id}
              jobTitle={showKitModalJob.title}
              company={showKitModalJob.company}
              onClose={() => setShowKitModalJob(null)}
            />
          </div>
        </div>
      )}

    </div>
  );
}
