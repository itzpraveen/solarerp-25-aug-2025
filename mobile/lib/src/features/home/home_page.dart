import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../config/app_config.dart';
import '../../data/models.dart';
import '../../data/solarerp_repository.dart';

const String _allBranchesValue = '__all__';

enum LeadsFilterMode { all, open, dueToday, overdue, converted, lost }

enum LeadsSortMode { followUp, newest, highestScore }

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.config, required this.repository});

  final AppConfig config;
  final SolarErpRepository repository;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _loading = true;
  bool _syncing = false;
  String? _error;

  int _tabIndex = 0;
  DateTime? _lastSyncedAt;

  UserProfile? _profile;
  List<Branch> _branches = const [];
  String? _selectedBranchId;

  OverviewKpi? _overview;
  List<LeadSummary> _leads = const [];

  final TextEditingController _leadSearchController = TextEditingController();
  LeadsFilterMode _leadsFilterMode = LeadsFilterMode.all;
  LeadsSortMode _leadsSortMode = LeadsSortMode.followUp;

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  @override
  void dispose() {
    _leadSearchController.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final profile = await widget.repository.fetchMyProfile();
      if (profile == null) {
        throw StateError(
          'No tenant profile found for this user. Ask your admin to invite you.',
        );
      }

      final branches = await widget.repository.fetchBranches();
      final validSelection = branches.any((b) => b.id == _selectedBranchId);
      if (!validSelection) {
        _selectedBranchId = null;
      }

      final results = await Future.wait<dynamic>([
        widget.repository.fetchOverview(branchId: _selectedBranchId),
        widget.repository.fetchLeads(branchId: _selectedBranchId),
      ]);

      if (!mounted) return;
      setState(() {
        _profile = profile;
        _branches = branches;
        _overview = results[0] as OverviewKpi;
        _leads = results[1] as List<LeadSummary>;
        _lastSyncedAt = DateTime.now();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _refreshBranchData() async {
    if (_loading) return;
    setState(() {
      _syncing = true;
      _error = null;
    });

    try {
      final results = await Future.wait<dynamic>([
        widget.repository.fetchOverview(branchId: _selectedBranchId),
        widget.repository.fetchLeads(branchId: _selectedBranchId),
      ]);
      if (!mounted) return;
      setState(() {
        _overview = results[0] as OverviewKpi;
        _leads = results[1] as List<LeadSummary>;
        _lastSyncedAt = DateTime.now();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _syncing = false;
        });
      }
    }
  }

  Future<void> _onBranchChanged(String? value) async {
    final next = value == _allBranchesValue ? null : value;
    setState(() {
      _selectedBranchId = next;
    });
    await _refreshBranchData();
  }

  Future<void> _signOut() async {
    await Supabase.instance.client.auth.signOut();
  }

  Map<String, String> _branchNameById() {
    final map = <String, String>{};
    for (final branch in _branches) {
      map[branch.id] = branch.name;
    }
    return map;
  }

  List<LeadSummary> _visibleLeads() {
    final query = _leadSearchController.text.trim().toLowerCase();
    final filtered = _leads.where((lead) {
      if (!_matchesLeadFilter(lead)) return false;
      if (query.isEmpty) return true;
      final haystack = [
        lead.name ?? '',
        lead.phone ?? '',
        lead.source ?? '',
        lead.status ?? '',
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();

    filtered.sort((a, b) {
      switch (_leadsSortMode) {
        case LeadsSortMode.followUp:
          if (a.isOverdue != b.isOverdue) return a.isOverdue ? -1 : 1;
          if (a.isDueToday != b.isDueToday) return a.isDueToday ? -1 : 1;
          final byFollowUp = _compareNullableDateAsc(
            a.nextFollowUpDate,
            b.nextFollowUpDate,
          );
          if (byFollowUp != 0) return byFollowUp;
          return b.score.compareTo(a.score);
        case LeadsSortMode.newest:
          return _compareNullableDateDesc(a.date, b.date);
        case LeadsSortMode.highestScore:
          final byScore = b.score.compareTo(a.score);
          if (byScore != 0) return byScore;
          return _compareNullableDateAsc(
            a.nextFollowUpDate,
            b.nextFollowUpDate,
          );
      }
    });

    return filtered;
  }

  bool _matchesLeadFilter(LeadSummary lead) {
    switch (_leadsFilterMode) {
      case LeadsFilterMode.all:
        return true;
      case LeadsFilterMode.open:
        return lead.isOpen;
      case LeadsFilterMode.dueToday:
        return lead.isDueToday;
      case LeadsFilterMode.overdue:
        return lead.isOverdue;
      case LeadsFilterMode.converted:
        return lead.isConverted;
      case LeadsFilterMode.lost:
        return lead.isLost;
    }
  }

  int _countByFilter(LeadsFilterMode mode) {
    if (mode == LeadsFilterMode.all) return _leads.length;
    return _leads.where((lead) {
      switch (mode) {
        case LeadsFilterMode.all:
          return true;
        case LeadsFilterMode.open:
          return lead.isOpen;
        case LeadsFilterMode.dueToday:
          return lead.isDueToday;
        case LeadsFilterMode.overdue:
          return lead.isOverdue;
        case LeadsFilterMode.converted:
          return lead.isConverted;
        case LeadsFilterMode.lost:
          return lead.isLost;
      }
    }).length;
  }

  String _branchLabel() {
    if (_selectedBranchId == null) return 'All';
    for (final b in _branches) {
      if (b.id == _selectedBranchId) return b.name;
    }
    return 'All';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_loading) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 48,
                height: 48,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Loading workspace...',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_error != null && _profile == null) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.errorContainer.withValues(alpha: 0.3),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.cloud_off_rounded,
                      size: 48,
                      color: theme.colorScheme.error,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Unable to load workspace',
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: _loadInitial,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Retry'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _signOut,
                    child: const Text('Sign out'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final visibleLeads = _visibleLeads();
    final syncText = _lastSyncedAt == null
        ? null
        : 'Updated ${DateFormat('dd MMM, hh:mm a').format(_lastSyncedAt!)}';

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.wb_sunny_rounded,
              size: 24,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(width: 8),
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Tenaga Hub',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (syncText != null)
                  Text(
                    syncText,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
          ],
        ),
        actions: [
          if (_branches.length > 1)
            PopupMenuButton<String>(
              tooltip: 'Select branch',
              onSelected: _syncing ? null : _onBranchChanged,
              position: PopupMenuPosition.under,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Chip(
                  avatar: Icon(
                    Icons.business_outlined,
                    size: 16,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  label: Text(
                    _branchLabel(),
                    style: theme.textTheme.labelMedium,
                  ),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                ),
              ),
              itemBuilder: (context) => [
                const PopupMenuItem<String>(
                  value: _allBranchesValue,
                  child: Text('All Branches'),
                ),
                ..._branches.map(
                  (branch) => PopupMenuItem<String>(
                    value: branch.id,
                    child: Text(branch.name),
                  ),
                ),
              ],
            ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _syncing ? null : _refreshBranchData,
            icon: _syncing
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_syncing) const LinearProgressIndicator(minHeight: 2),
            if (_error != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: theme.colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.warning_amber_rounded,
                      size: 18,
                      color: theme.colorScheme.onErrorContainer,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onErrorContainer,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: IndexedStack(
                  key: ValueKey(_tabIndex),
                  index: _tabIndex,
                  children: [
                    _DashboardTab(
                      overview: _overview,
                      profile: _profile,
                      onRefresh: _refreshBranchData,
                    ),
                    _LeadsTab(
                      allLeads: _leads,
                      visibleLeads: visibleLeads,
                      searchController: _leadSearchController,
                      onSearchChanged: (_) => setState(() {}),
                      filterMode: _leadsFilterMode,
                      onFilterModeChanged: (next) {
                        setState(() {
                          _leadsFilterMode = next;
                        });
                      },
                      sortMode: _leadsSortMode,
                      onSortModeChanged: (next) {
                        setState(() {
                          _leadsSortMode = next;
                        });
                      },
                      countByFilter: _countByFilter,
                      onRefresh: _refreshBranchData,
                      branchNameById: _branchNameById(),
                    ),
                    _AccountTab(
                      profile: _profile,
                      config: widget.config,
                      onSignOut: _signOut,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (index) {
          setState(() {
            _tabIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Overview',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people),
            label: 'Leads',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Account',
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Dashboard Tab
// ---------------------------------------------------------------------------

class _DashboardTab extends StatelessWidget {
  const _DashboardTab({
    required this.overview,
    required this.profile,
    required this.onRefresh,
  });

  final OverviewKpi? overview;
  final UserProfile? profile;
  final Future<void> Function() onRefresh;

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (overview == null) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const SizedBox(height: 120),
            Column(
              children: [
                Icon(
                  Icons.bar_chart_rounded,
                  size: 48,
                  color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
                ),
                const SizedBox(height: 12),
                Text(
                  'No KPI data available yet.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }

    final kpi = overview!;
    final conversionRate = _toPercent(kpi.converted, kpi.total);
    final followUpRisk = _toPercent(kpi.overdue, kpi.open);
    final displayName = profile?.displayName?.trim().isNotEmpty == true
        ? profile!.displayName!.split(' ').first
        : null;
    final todayStr = DateFormat('EEEE, d MMM').format(DateTime.now());

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          // Greeting
          Padding(
            padding: const EdgeInsets.only(bottom: 16, top: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayName != null
                      ? '${_greeting()}, $displayName'
                      : _greeting(),
                  style: theme.textTheme.headlineSmall,
                ),
                const SizedBox(height: 2),
                Text(
                  todayStr,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),

          // Hero cards
          Row(
            children: [
              Expanded(
                child: _HeroCard(
                  label: 'Conversion Rate',
                  value: conversionRate,
                  icon: Icons.trending_up_rounded,
                  gradient: const [Color(0xFF00A650), Color(0xFF4ADE80)],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _HeroCard(
                  label: 'Follow-up Risk',
                  value: followUpRisk,
                  icon: Icons.warning_amber_rounded,
                  gradient: kpi.overdue > 0
                      ? const [Color(0xFFD84315), Color(0xFFF4511E)]
                      : const [Color(0xFF546E7A), Color(0xFF78909C)],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Quick stats row
          Row(
            children: [
              _QuickStat(
                label: 'Total',
                value: kpi.total.toString(),
                color: theme.colorScheme.primary,
              ),
              _QuickStat(
                label: 'Open',
                value: kpi.open.toString(),
                color: Colors.blue.shade600,
              ),
              _QuickStat(
                label: 'Due Today',
                value: kpi.dueToday.toString(),
                color: Colors.orange.shade700,
              ),
              _QuickStat(
                label: 'Overdue',
                value: kpi.overdue.toString(),
                color: Colors.red.shade700,
              ),
            ],
          ),
          const SizedBox(height: 24),

          // This Week section
          _SectionHeader(title: 'This Week'),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _KpiTile(
                  label: 'New',
                  value: kpi.newWeek.toString(),
                  icon: Icons.fiber_new_rounded,
                  color: Colors.blue,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _KpiTile(
                  label: 'Converted',
                  value: kpi.converted.toString(),
                  icon: Icons.check_circle_outline_rounded,
                  color: Colors.green,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _KpiTile(
                  label: 'Proposals',
                  value: kpi.proposalsWeek.toString(),
                  icon: Icons.request_quote_outlined,
                  color: Colors.deepPurple,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // This Month section
          _SectionHeader(title: 'This Month'),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _KpiTile(
                  label: 'Leads',
                  value: kpi.leadsNewMonth.toString(),
                  icon: Icons.person_add_outlined,
                  color: Colors.teal,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _KpiTile(
                  label: 'Converted',
                  value: kpi.leadsConvertedMonth.toString(),
                  icon: Icons.auto_graph_rounded,
                  color: Colors.green,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _KpiTile(
                  label: 'Proposals',
                  value: kpi.proposalsMonth.toString(),
                  icon: Icons.summarize_outlined,
                  color: Colors.indigo,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Leads Tab
// ---------------------------------------------------------------------------

class _LeadsTab extends StatelessWidget {
  const _LeadsTab({
    required this.allLeads,
    required this.visibleLeads,
    required this.searchController,
    required this.onSearchChanged,
    required this.filterMode,
    required this.onFilterModeChanged,
    required this.sortMode,
    required this.onSortModeChanged,
    required this.countByFilter,
    required this.onRefresh,
    required this.branchNameById,
  });

  final List<LeadSummary> allLeads;
  final List<LeadSummary> visibleLeads;
  final TextEditingController searchController;
  final ValueChanged<String> onSearchChanged;
  final LeadsFilterMode filterMode;
  final ValueChanged<LeadsFilterMode> onFilterModeChanged;
  final LeadsSortMode sortMode;
  final ValueChanged<LeadsSortMode> onSortModeChanged;
  final int Function(LeadsFilterMode mode) countByFilter;
  final Future<void> Function() onRefresh;
  final Map<String, String> branchNameById;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        // Search
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: TextField(
            controller: searchController,
            onChanged: onSearchChanged,
            decoration: InputDecoration(
              hintText: 'Search leads...',
              prefixIcon: const Icon(Icons.search_rounded),
              isDense: true,
              suffixIcon: searchController.text.trim().isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear search',
                      onPressed: () {
                        searchController.clear();
                        onSearchChanged('');
                      },
                      icon: const Icon(Icons.close_rounded, size: 20),
                    ),
            ),
          ),
        ),
        const SizedBox(height: 8),

        // Filter chips
        SizedBox(
          height: 40,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              for (final mode in LeadsFilterMode.values)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    selected: filterMode == mode,
                    onSelected: (_) => onFilterModeChanged(mode),
                    label: Text(
                      '${_leadsFilterLabel(mode)} (${countByFilter(mode)})',
                    ),
                    selectedColor: _filterChipColor(mode),
                    showCheckmark: false,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
            ],
          ),
        ),

        // Sort + count row
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 4),
          child: Row(
            children: [
              Text(
                '${visibleLeads.length} of ${allLeads.length}',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const Spacer(),
              PopupMenuButton<LeadsSortMode>(
                tooltip: 'Sort by',
                onSelected: onSortModeChanged,
                position: PopupMenuPosition.under,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.sort_rounded,
                      size: 16,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _sortLabel(sortMode),
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: theme.colorScheme.primary,
                      ),
                    ),
                  ],
                ),
                itemBuilder: (context) => const [
                  PopupMenuItem(
                    value: LeadsSortMode.followUp,
                    child: Text('Follow-up priority'),
                  ),
                  PopupMenuItem(
                    value: LeadsSortMode.newest,
                    child: Text('Newest leads'),
                  ),
                  PopupMenuItem(
                    value: LeadsSortMode.highestScore,
                    child: Text('Highest score'),
                  ),
                ],
              ),
            ],
          ),
        ),

        // Lead list
        Expanded(
          child: RefreshIndicator(
            onRefresh: onRefresh,
            child: visibleLeads.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      const SizedBox(height: 80),
                      Column(
                        children: [
                          Icon(
                            Icons.person_search_rounded,
                            size: 56,
                            color: theme.colorScheme.onSurfaceVariant
                                .withValues(alpha: 0.3),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'No leads found',
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Try clearing search or changing filters.',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant
                                  .withValues(alpha: 0.7),
                            ),
                          ),
                        ],
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                    itemCount: visibleLeads.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final lead = visibleLeads[index];
                      return _LeadCard(
                        lead: lead,
                        branchName: branchNameById[lead.branchId ?? ''],
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Account Tab
// ---------------------------------------------------------------------------

class _AccountTab extends StatelessWidget {
  const _AccountTab({
    required this.profile,
    required this.config,
    required this.onSignOut,
  });

  final UserProfile? profile;
  final AppConfig config;
  final Future<void> Function() onSignOut;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = Supabase.instance.client.auth.currentUser;

    final displayName = profile?.displayName?.trim().isNotEmpty == true
        ? profile!.displayName!
        : (user?.email ?? 'User');
    final initials = _initials(displayName);
    final role = profile?.role ?? '—';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SizedBox(height: 8),
        // Profile header
        Center(
          child: Column(
            children: [
              CircleAvatar(
                radius: 40,
                backgroundColor: theme.colorScheme.primaryContainer,
                child: Text(
                  initials,
                  style: theme.textTheme.headlineMedium?.copyWith(
                    color: theme.colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(displayName, style: theme.textTheme.titleLarge),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: theme.colorScheme.secondaryContainer,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  role,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: theme.colorScheme.onSecondaryContainer,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Info section
        Card(
          child: Column(
            children: [
              ListTile(
                leading: Icon(Icons.email_outlined,
                    color: theme.colorScheme.onSurfaceVariant),
                title: const Text('Email'),
                subtitle: Text(user?.email ?? '—'),
              ),
              const Divider(indent: 56),
              ListTile(
                leading: Icon(Icons.alternate_email,
                    color: theme.colorScheme.onSurfaceVariant),
                title: const Text('Username'),
                subtitle: Text(profile?.username ?? '—'),
              ),
              const Divider(indent: 56),
              ListTile(
                leading: Icon(Icons.domain_outlined,
                    color: theme.colorScheme.onSurfaceVariant),
                title: const Text('Tenant'),
                subtitle: Text(profile?.tenantId ?? '—'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Backend section (debug info)
        Theme(
          data: theme.copyWith(dividerColor: Colors.transparent),
          child: Card(
            child: ExpansionTile(
              leading: Icon(Icons.dns_outlined,
                  color: theme.colorScheme.onSurfaceVariant),
              title: Text(
                'Backend',
                style: theme.textTheme.titleSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              children: [
                _DetailRow(label: 'API Base', value: config.apiBaseUrl),
                const SizedBox(height: 4),
                _DetailRow(label: 'Supabase URL', value: config.supabaseUrl),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),

        // Sign out
        OutlinedButton.icon(
          onPressed: onSignOut,
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Sign out'),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(double.infinity, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        const SizedBox(height: 20),
        Center(
          child: Text(
            'Tenaga Hub v1.0.0',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Widget building blocks
// ---------------------------------------------------------------------------

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.gradient,
  });

  final String label;
  final String value;
  final IconData icon;
  final List<Color> gradient;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradient,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: gradient.first.withValues(alpha: 0.3),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 24, color: Colors.white.withValues(alpha: 0.85)),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickStat extends StatelessWidget {
  const _QuickStat({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(12),
          border: Border(
            top: BorderSide(color: color, width: 2.5),
          ),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text(
      title,
      style: theme.textTheme.titleSmall?.copyWith(
        color: theme.colorScheme.onSurfaceVariant,
        letterSpacing: 0.5,
      ),
    );
  }
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final MaterialColor color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 20, color: color.shade700),
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LeadCard extends StatelessWidget {
  const _LeadCard({required this.lead, required this.branchName});

  final LeadSummary lead;
  final String? branchName;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final name = lead.name?.trim().isNotEmpty == true
        ? lead.name!
        : 'Unnamed lead';
    final status = lead.status?.trim().isNotEmpty == true ? lead.status! : '—';
    final statusColor = _statusColor(status);
    final followUpText = _formatDate(lead.nextFollowUpDate);
    final createdDateText = _formatDate(lead.date);
    final initials = _initials(name);

    Color? stripeColor;
    if (lead.isOverdue) {
      stripeColor = Colors.red.shade600;
    } else if (lead.isDueToday) {
      stripeColor = Colors.orange.shade600;
    }

    return Card(
      child: IntrinsicHeight(
        child: Row(
          children: [
            // Left colored stripe
            Container(
              width: 4,
              decoration: BoxDecoration(
                color: stripeColor ?? Colors.transparent,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(16),
                  bottomLeft: Radius.circular(16),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title row
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: statusColor.withValues(alpha: 0.12),
                          child: Text(
                            initials,
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: statusColor,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            name,
                            style: theme.textTheme.titleSmall,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: statusColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            status,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: statusColor,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // Phone
                    if (lead.phone != null && lead.phone!.trim().isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(left: 46, bottom: 6),
                        child: Row(
                          children: [
                            Icon(
                              Icons.phone_outlined,
                              size: 14,
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              lead.phone!,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Source + Branch chips
                    Padding(
                      padding: const EdgeInsets.only(left: 46),
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          if (lead.source != null &&
                              lead.source!.trim().isNotEmpty)
                            _TagChip(label: lead.source!),
                          if (branchName != null)
                            _TagChip(label: branchName!),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Footer: follow-up, score, created
                    Padding(
                      padding: const EdgeInsets.only(left: 46),
                      child: Row(
                        children: [
                          Icon(
                            Icons.calendar_today_rounded,
                            size: 12,
                            color: stripeColor ??
                                theme.colorScheme.onSurfaceVariant,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            followUpText,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: stripeColor ??
                                  theme.colorScheme.onSurfaceVariant,
                              fontWeight:
                                  stripeColor != null ? FontWeight.w600 : null,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Icon(
                            Icons.star_outline_rounded,
                            size: 12,
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            '${lead.score}',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            createdDateText,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant
                                  .withValues(alpha: 0.6),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 100,
          child: Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: theme.textTheme.bodySmall,
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

String _formatDate(DateTime? date) {
  if (date == null) return '—';
  return DateFormat('dd MMM yyyy').format(date);
}

int _compareNullableDateAsc(DateTime? a, DateTime? b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a.compareTo(b);
}

int _compareNullableDateDesc(DateTime? a, DateTime? b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b.compareTo(a);
}

String _toPercent(int numerator, int denominator) {
  if (denominator <= 0) return '0%';
  final value = (numerator * 100) / denominator;
  return '${value.toStringAsFixed(1)}%';
}

String _leadsFilterLabel(LeadsFilterMode mode) {
  switch (mode) {
    case LeadsFilterMode.all:
      return 'All';
    case LeadsFilterMode.open:
      return 'Open';
    case LeadsFilterMode.dueToday:
      return 'Due Today';
    case LeadsFilterMode.overdue:
      return 'Overdue';
    case LeadsFilterMode.converted:
      return 'Converted';
    case LeadsFilterMode.lost:
      return 'Lost';
  }
}

Color? _filterChipColor(LeadsFilterMode mode) {
  switch (mode) {
    case LeadsFilterMode.overdue:
      return Colors.red.shade50;
    case LeadsFilterMode.dueToday:
      return Colors.orange.shade50;
    case LeadsFilterMode.converted:
      return Colors.green.shade50;
    case LeadsFilterMode.lost:
      return Colors.grey.shade200;
    default:
      return null;
  }
}

String _sortLabel(LeadsSortMode mode) {
  switch (mode) {
    case LeadsSortMode.followUp:
      return 'Follow-up';
    case LeadsSortMode.newest:
      return 'Newest';
    case LeadsSortMode.highestScore:
      return 'Score';
  }
}

Color _statusColor(String rawStatus) {
  final status = rawStatus.trim().toLowerCase();
  if (status == 'converted') return Colors.green.shade700;
  if (status == 'lost') return Colors.red.shade700;
  if (status == 'closed') return Colors.blueGrey.shade600;
  if (status == 'qualified') return Colors.indigo.shade700;
  if (status == 'quoted') return Colors.deepPurple.shade700;
  return Colors.blue.shade700;
}

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty || parts.first.isEmpty) return '?';
  if (parts.length == 1) return parts.first[0].toUpperCase();
  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}
