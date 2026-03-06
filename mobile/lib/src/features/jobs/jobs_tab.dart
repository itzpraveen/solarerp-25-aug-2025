import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../config/app_config.dart';
import '../../data/models.dart';
import '../../data/solarerp_repository.dart';
import '../../utils/launcher.dart';
import 'job_detail_page.dart';

const List<String> _pipelineStatuses = [
  'Lead',
  'Qualified',
  'Quoted',
  'Won',
  'KSEB_Submitted',
  'Material_Ordered',
  'Installed',
  'Net_Metered',
  'Handover',
  'Closed',
  'Lost',
];

class JobsTab extends StatefulWidget {
  const JobsTab({
    super.key,
    required this.repository,
    required this.branchId,
    this.config,
  });

  final SolarErpRepository repository;
  final String? branchId;
  final AppConfig? config;

  @override
  State<JobsTab> createState() => JobsTabState();
}

class JobsTabState extends State<JobsTab> {
  List<JobSummary> _jobs = const [];
  bool _loading = true;
  String? _filterStatus;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    loadJobs();
  }

  @override
  void didUpdateWidget(covariant JobsTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.branchId != widget.branchId) {
      loadJobs();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> loadJobs() async {
    setState(() => _loading = true);
    try {
      final jobs = await widget.repository.fetchJobs(branchId: widget.branchId);
      if (!mounted) return;
      setState(() {
        _jobs = jobs;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, int> _statusCounts() {
    final counts = <String, int>{};
    for (final job in _jobs) {
      final s = job.status ?? 'Unknown';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }

  List<JobSummary> _filteredJobs() {
    var result = _jobs;
    if (_filterStatus != null) {
      result = result.where((j) => j.status == _filterStatus).toList();
    }
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      result = result.where((j) {
        final name = (j.customerName ?? '').toLowerCase();
        final loc = (j.location ?? '').toLowerCase();
        final phone = (j.customerPhone ?? '').toLowerCase();
        return name.contains(q) || loc.contains(q) || phone.contains(q);
      }).toList();
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    final counts = _statusCounts();
    final filtered = _filteredJobs();

    return Column(
      children: [
        // Search
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: TextField(
            controller: _searchController,
            onChanged: (v) => setState(() => _searchQuery = v.trim()),
            decoration: InputDecoration(
              hintText: 'Search jobs...',
              prefixIcon: const Icon(Icons.search_rounded),
              isDense: true,
              suffixIcon: _searchQuery.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear search',
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                      icon: const Icon(Icons.close_rounded, size: 20),
                    ),
            ),
          ),
        ),
        const SizedBox(height: 8),

        // Pipeline status chips
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            children: [
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  selected: _filterStatus == null,
                  onSelected: (_) => setState(() => _filterStatus = null),
                  label: Text('All (${_jobs.length})'),
                  showCheckmark: false,
                  visualDensity: VisualDensity.compact,
                ),
              ),
              for (final status in _pipelineStatuses)
                if (counts.containsKey(status))
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      selected: _filterStatus == status,
                      onSelected: (_) => setState(() {
                        _filterStatus = _filterStatus == status ? null : status;
                      }),
                      label: Text(
                        '${_displayStatus(status)} (${counts[status]})',
                      ),
                      selectedColor: _jobStatusColor(
                        status,
                      ).withValues(alpha: 0.15),
                      showCheckmark: false,
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
            ],
          ),
        ),

        // Count
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              '${filtered.length} jobs',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ),

        // Job list
        Expanded(
          child: RefreshIndicator(
            onRefresh: loadJobs,
            child: filtered.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      const SizedBox(height: 80),
                      Column(
                        children: [
                          Icon(
                            Icons.work_outline_rounded,
                            size: 56,
                            color: theme.colorScheme.onSurfaceVariant
                                .withValues(alpha: 0.3),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'No jobs found',
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                    itemCount: filtered.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final job = filtered[index];
                      return _JobCard(
                        job: job,
                        repository: widget.repository,
                        config: widget.config,
                        onChanged: loadJobs,
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

class _JobCard extends StatelessWidget {
  const _JobCard({
    required this.job,
    required this.repository,
    this.config,
    required this.onChanged,
  });

  final JobSummary job;
  final AppConfig? config;
  final SolarErpRepository repository;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusColor = _jobStatusColor(job.status ?? '');
    final custName = job.customerName ?? 'Unknown Customer';

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => JobDetailPage(
                jobId: job.id,
                repository: repository,
                config: config,
              ),
            ),
          );
          onChanged();
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row
              Row(
                children: [
                  Expanded(
                    child: Text(
                      custName,
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
                      _displayStatus(job.status ?? ''),
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),

              // System type + capacity
              Row(
                children: [
                  Icon(
                    Icons.solar_power_outlined,
                    size: 14,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    [
                      if (job.systemType != null) job.systemType!,
                      if (job.capacityKw != null) '${job.capacityKw} kW',
                    ].join(' · '),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),

              // Phone row with quick call
              if (job.customerPhone != null) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      Icons.phone_outlined,
                      size: 14,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        job.customerPhone!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: () => makePhoneCall(job.customerPhone!),
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Icon(
                          Icons.phone_rounded,
                          size: 16,
                          color: Colors.green.shade600,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    InkWell(
                      onTap: () => openWhatsApp(job.customerPhone!),
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Icon(
                          Icons.message_rounded,
                          size: 16,
                          color: const Color(0xFF25D366),
                        ),
                      ),
                    ),
                  ],
                ),
              ],

              // Amount + dates footer
              const SizedBox(height: 8),
              Row(
                children: [
                  if (job.totalAmount != null && job.totalAmount! > 0) ...[
                    Text(
                      _formatAmount(job.totalAmount!),
                      style: theme.textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
                  if (job.location != null) ...[
                    Icon(
                      Icons.location_on_outlined,
                      size: 12,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: 2),
                    Expanded(
                      child: Text(
                        job.location!,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ] else
                    const Spacer(),
                  if (job.createdAt != null)
                    Text(
                      DateFormat('dd MMM').format(job.createdAt!),
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant.withValues(
                          alpha: 0.6,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _displayStatus(String status) {
  return status.replaceAll('_', ' ');
}

Color _jobStatusColor(String rawStatus) {
  final s = rawStatus.trim();
  switch (s) {
    case 'Lead':
      return Colors.blue.shade600;
    case 'Qualified':
      return Colors.indigo.shade600;
    case 'Quoted':
      return Colors.deepPurple.shade600;
    case 'Won':
      return Colors.green.shade700;
    case 'KSEB_Submitted':
      return Colors.teal.shade600;
    case 'Material_Ordered':
      return Colors.orange.shade700;
    case 'Installed':
      return Colors.cyan.shade700;
    case 'Net_Metered':
      return Colors.lightGreen.shade700;
    case 'Handover':
      return Colors.green.shade800;
    case 'Closed':
      return Colors.blueGrey.shade600;
    case 'Lost':
      return Colors.red.shade700;
    default:
      return Colors.grey.shade600;
  }
}

String _formatAmount(double amount) {
  if (amount >= 100000) {
    return '${(amount / 100000).toStringAsFixed(1)}L';
  } else if (amount >= 1000) {
    return '${(amount / 1000).toStringAsFixed(1)}K';
  }
  return amount.toStringAsFixed(0);
}
