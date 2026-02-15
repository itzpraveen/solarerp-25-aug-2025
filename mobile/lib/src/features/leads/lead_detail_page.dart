import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../data/models.dart';
import '../../data/solarerp_repository.dart';
import '../../utils/launcher.dart';

class LeadDetailPage extends StatefulWidget {
  const LeadDetailPage({
    super.key,
    required this.leadId,
    required this.repository,
  });

  final String leadId;
  final SolarErpRepository repository;

  @override
  State<LeadDetailPage> createState() => _LeadDetailPageState();
}

class _LeadDetailPageState extends State<LeadDetailPage> {
  LeadDetail? _lead;
  bool _loading = true;
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final lead = await widget.repository.fetchLeadById(widget.leadId);
    if (!mounted) return;
    setState(() {
      _lead = lead;
      _loading = false;
    });
  }

  Future<void> _updateStatus(String newStatus) async {
    try {
      await widget.repository.updateLead(widget.leadId, {'status': newStatus});
      _changed = true;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Status updated to $newStatus'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update status: $e'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.red.shade600,
          ),
        );
      }
    }
  }

  Future<void> _pickFollowUpDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _lead?.nextFollowUpDate ?? now,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365 * 2)),
    );
    if (picked == null || !mounted) return;
    final ymd = DateFormat('yyyy-MM-dd').format(picked);
    try {
      await widget.repository.updateLead(widget.leadId, {'next_follow_up_date': ymd});
      _changed = true;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Follow-up set to ${DateFormat('dd MMM').format(picked)}'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update follow-up: $e'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.red.shade600,
          ),
        );
      }
    }
  }

  Future<void> _editNotes() async {
    final controller = TextEditingController(text: _lead?.notes ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit Notes'),
        content: TextField(
          controller: controller,
          maxLines: 5,
          decoration: const InputDecoration(hintText: 'Enter notes...'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (result == null || !mounted) return;
    await widget.repository.updateLead(widget.leadId, {'notes': result});
    _changed = true;
    await _load();
  }

  void _showEditSheet() {
    final lead = _lead;
    if (lead == null) return;

    final nameCtl = TextEditingController(text: lead.name ?? '');
    final phoneCtl = TextEditingController(text: lead.phone ?? '');
    final emailCtl = TextEditingController(text: lead.email ?? '');
    final addressCtl = TextEditingController(text: lead.address ?? '');
    final capacityCtl = TextEditingController(
      text: lead.interestedCapacityKw != null
          ? lead.interestedCapacityKw.toString()
          : '',
    );
    String source = lead.source ?? '';
    final sources = [
      '',
      'Referral',
      'Walk-in',
      'Online',
      'Facebook',
      'Instagram',
      'Google',
      'Newspaper',
      'Other',
    ];
    bool saving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Edit Lead',
                    style: Theme.of(ctx).textTheme.titleMedium),
                const SizedBox(height: 16),
                TextField(
                  controller: nameCtl,
                  decoration: const InputDecoration(
                    labelText: 'Name',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: phoneCtl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Phone',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: emailCtl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: addressCtl,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Address',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: sources.contains(source) ? source : '',
                  decoration: const InputDecoration(
                    labelText: 'Source',
                    border: OutlineInputBorder(),
                  ),
                  items: sources
                      .map((s) => DropdownMenuItem(
                            value: s,
                            child: Text(s.isEmpty ? '— None —' : s),
                          ))
                      .toList(),
                  onChanged: (v) => setLocal(() => source = v ?? ''),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: capacityCtl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Interested Capacity (kW)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: saving
                      ? null
                      : () async {
                          setLocal(() => saving = true);
                          final patch = <String, dynamic>{
                            'name': nameCtl.text.trim(),
                            'phone': phoneCtl.text.trim().isEmpty
                                ? null
                                : phoneCtl.text.trim(),
                            'email': emailCtl.text.trim().isEmpty
                                ? null
                                : emailCtl.text.trim(),
                            'address': addressCtl.text.trim().isEmpty
                                ? null
                                : addressCtl.text.trim(),
                            'source': source.isEmpty ? null : source,
                            'interested_capacity_kw':
                                double.tryParse(capacityCtl.text.trim()),
                          };
                          try {
                            await widget.repository
                                .updateLead(widget.leadId, patch);
                            _changed = true;
                            if (ctx.mounted) Navigator.pop(ctx);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Lead updated'),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            }
                            await _load();
                          } catch (e) {
                            setLocal(() => saving = false);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Save failed: $e'),
                                  behavior: SnackBarBehavior.floating,
                                  backgroundColor: Colors.red.shade600,
                                ),
                              );
                            }
                          }
                        },
                  child: saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Save'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showStatusSheet() {
    final statuses = ['New', 'Contacted', 'Qualified', 'Quoted', 'Converted', 'Lost'];
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Update Status', style: Theme.of(ctx).textTheme.titleMedium),
            ),
            for (final s in statuses)
              ListTile(
                title: Text(s),
                trailing: s.toLowerCase() == (_lead?.status ?? '').toLowerCase()
                    ? const Icon(Icons.check_circle, color: Colors.green)
                    : null,
                onTap: () {
                  Navigator.pop(ctx);
                  _updateStatus(s);
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop && _changed) {
          // Signal refresh needed
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Lead Details'),
          actions: [
            IconButton(
              tooltip: 'Edit Lead',
              onPressed: _lead == null ? null : _showEditSheet,
              icon: const Icon(Icons.edit_rounded),
            ),
            IconButton(
              tooltip: 'Update Status',
              onPressed: _lead == null ? null : _showStatusSheet,
              icon: const Icon(Icons.swap_horiz_rounded),
            ),
          ],
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _lead == null
                ? Center(
                    child: Text('Lead not found', style: theme.textTheme.bodyLarge),
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _buildBody(theme),
                  ),
      ),
    );
  }

  Widget _buildBody(ThemeData theme) {
    final lead = _lead!;
    final name = lead.name?.isNotEmpty == true ? lead.name! : 'Unnamed Lead';
    final status = lead.status ?? '—';
    final statusColor = _statusColor(status);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        // Header
        Row(
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: statusColor.withValues(alpha: 0.12),
              child: Text(
                _initials(name),
                style: theme.textTheme.titleLarge?.copyWith(
                  color: statusColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: theme.textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
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
                      const SizedBox(width: 8),
                      if (lead.score > 0)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.star_rounded, size: 16, color: Colors.amber.shade700),
                            const SizedBox(width: 2),
                            Text(
                              '${lead.score}',
                              style: theme.textTheme.labelMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        // Contact actions
        if (lead.phone != null || lead.email != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  if (lead.phone != null)
                    _ContactButton(
                      icon: Icons.phone_rounded,
                      label: 'Call',
                      color: Colors.green,
                      onTap: () => makePhoneCall(lead.phone!),
                    ),
                  if (lead.phone != null)
                    _ContactButton(
                      icon: Icons.message_rounded,
                      label: 'WhatsApp',
                      color: const Color(0xFF25D366),
                      onTap: () => openWhatsApp(lead.phone!),
                    ),
                  if (lead.email != null)
                    _ContactButton(
                      icon: Icons.email_rounded,
                      label: 'Email',
                      color: Colors.blue,
                      onTap: () => sendEmail(lead.email!),
                    ),
                ],
              ),
            ),
          ),
        if (lead.phone != null || lead.email != null)
          const SizedBox(height: 12),

        // Follow-up card
        Card(
          child: ListTile(
            leading: Icon(
              Icons.calendar_today_rounded,
              color: lead.isOverdue
                  ? Colors.red.shade600
                  : lead.isDueToday
                      ? Colors.orange.shade600
                      : theme.colorScheme.primary,
            ),
            title: Text(
              lead.nextFollowUpDate != null
                  ? 'Follow-up: ${DateFormat('dd MMM yyyy').format(lead.nextFollowUpDate!)}'
                  : 'No follow-up scheduled',
              style: TextStyle(
                color: lead.isOverdue
                    ? Colors.red.shade600
                    : lead.isDueToday
                        ? Colors.orange.shade600
                        : null,
                fontWeight: (lead.isOverdue || lead.isDueToday) ? FontWeight.w600 : null,
              ),
            ),
            subtitle: lead.isOverdue
                ? const Text('OVERDUE', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w700, fontSize: 11))
                : lead.isDueToday
                    ? const Text('DUE TODAY', style: TextStyle(color: Colors.orange, fontWeight: FontWeight.w700, fontSize: 11))
                    : null,
            trailing: IconButton(
              tooltip: 'Set follow-up date',
              onPressed: _pickFollowUpDate,
              icon: const Icon(Icons.edit_calendar_rounded),
            ),
          ),
        ),
        const SizedBox(height: 12),

        // Details card
        Card(
          child: Column(
            children: [
              if (lead.phone != null)
                ListTile(
                  leading: const Icon(Icons.phone_outlined),
                  title: const Text('Phone'),
                  subtitle: Text(lead.phone!),
                ),
              if (lead.email != null) ...[
                const Divider(indent: 56),
                ListTile(
                  leading: const Icon(Icons.email_outlined),
                  title: const Text('Email'),
                  subtitle: Text(lead.email!),
                ),
              ],
              if (lead.address != null) ...[
                const Divider(indent: 56),
                ListTile(
                  leading: const Icon(Icons.location_on_outlined),
                  title: const Text('Address'),
                  subtitle: Text(lead.address!),
                ),
              ],
              if (lead.source != null) ...[
                const Divider(indent: 56),
                ListTile(
                  leading: const Icon(Icons.source_outlined),
                  title: const Text('Source'),
                  subtitle: Text(lead.source!),
                ),
              ],
              if (lead.interestedCapacityKw != null) ...[
                const Divider(indent: 56),
                ListTile(
                  leading: const Icon(Icons.solar_power_outlined),
                  title: const Text('Interested Capacity'),
                  subtitle: Text('${lead.interestedCapacityKw} kW'),
                ),
              ],
              if (lead.date != null) ...[
                const Divider(indent: 56),
                ListTile(
                  leading: const Icon(Icons.event_outlined),
                  title: const Text('Created'),
                  subtitle: Text(DateFormat('dd MMM yyyy').format(lead.date!)),
                ),
              ],
              if (lead.lastContactedAt != null) ...[
                const Divider(indent: 56),
                ListTile(
                  leading: const Icon(Icons.access_time_rounded),
                  title: const Text('Last Contacted'),
                  subtitle: Text(DateFormat('dd MMM yyyy').format(lead.lastContactedAt!)),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Notes
        Card(
          child: ListTile(
            leading: const Icon(Icons.notes_rounded),
            title: const Text('Notes'),
            subtitle: Text(
              lead.notes?.isNotEmpty == true ? lead.notes! : 'No notes yet',
              style: TextStyle(
                color: lead.notes?.isNotEmpty == true
                    ? null
                    : theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
              ),
            ),
            trailing: IconButton(
              tooltip: 'Edit notes',
              onPressed: _editNotes,
              icon: const Icon(Icons.edit_rounded, size: 20),
            ),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _ContactButton extends StatelessWidget {
  const _ContactButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
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
