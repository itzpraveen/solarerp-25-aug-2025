import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../config/app_config.dart';
import '../../data/models.dart';
import '../../data/solarerp_repository.dart';
import '../../utils/launcher.dart';

const List<String> _pipelineStages = [
  'Lead', 'Qualified', 'Quoted', 'Won', 'KSEB_Submitted',
  'Material_Ordered', 'Installed', 'Net_Metered', 'Handover', 'Closed',
];

class JobDetailPage extends StatefulWidget {
  const JobDetailPage({
    super.key,
    required this.jobId,
    required this.repository,
    this.config,
  });

  final String jobId;
  final SolarErpRepository repository;
  final AppConfig? config;

  @override
  State<JobDetailPage> createState() => _JobDetailPageState();
}

class _JobDetailPageState extends State<JobDetailPage> {
  JobSummary? _job;
  Customer? _customer;
  List<TaskItem> _tasks = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final job = await widget.repository.fetchJobById(widget.jobId);
      if (job == null || !mounted) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      final results = await Future.wait([
        widget.repository.fetchCustomerById(job.customerId),
        widget.repository.fetchTasksForJob(widget.jobId),
      ]);
      if (!mounted) return;
      setState(() {
        _job = job;
        _customer = results[0] as Customer?;
        _tasks = results[1] as List<TaskItem>;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleTask(TaskItem task) async {
    final newStatus = task.isDone ? 'Open' : 'Done';
    await widget.repository.updateTaskStatus(task.id, newStatus);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(newStatus == 'Done' ? 'Task completed' : 'Task reopened'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 1),
        ),
      );
    }
    await _load();
  }

  void _showStatusSheet() {
    final allStages = [..._pipelineStages, 'Lost'];
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
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final stage in allStages)
                    ListTile(
                      title: Text(stage.replaceAll('_', ' ')),
                      trailing: stage == (_job?.status ?? '')
                          ? const Icon(Icons.check_circle, color: Colors.green)
                          : null,
                      onTap: () {
                        Navigator.pop(ctx);
                        _updateJobStatus(stage);
                      },
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _updateJobStatus(String newStatus) async {
    if (widget.config == null) return;
    setState(() => _loading = true);
    try {
      await widget.repository.updateJobStatus(
        jobId: widget.jobId,
        newStatus: newStatus,
        apiBaseUri: Uri.parse(widget.config!.apiBaseUrl),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Status updated to ${newStatus.replaceAll('_', ' ')}'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed: $e'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.red.shade600,
        ),
      );
    }
  }

  void _showEditSheet() {
    final capacityCtrl = TextEditingController(
      text: _job?.capacityKw?.toString() ?? '',
    );
    final locationCtrl = TextEditingController(text: _job?.location ?? '');
    final notesCtrl = TextEditingController(text: _job?.notes ?? '');
    String systemType = _job?.systemType ?? 'On-grid';

    // Site survey controllers
    final roofAreaCtrl = TextEditingController(text: _job?.roofAreaSqft?.toString() ?? '');
    final numFloorsCtrl = TextEditingController(text: _job?.numFloors?.toString() ?? '');
    final buildingHeightCtrl = TextEditingController(text: _job?.buildingHeightM?.toString() ?? '');
    final azimuthCtrl = TextEditingController(text: _job?.azimuthDeg?.toString() ?? '');
    final tiltCtrl = TextEditingController(text: _job?.tiltDeg?.toString() ?? '');
    final recCapacityCtrl = TextEditingController(text: _job?.recommendedCapacityKw?.toString() ?? '');
    final recPanelCtrl = TextEditingController(text: _job?.recommendedPanelCount?.toString() ?? '');
    final recInverterCtrl = TextEditingController(text: _job?.recommendedInverter ?? '');
    final obstructionCtrl = TextEditingController(text: _job?.obstructionNotes ?? '');
    final cableRunCtrl = TextEditingController(text: _job?.cableRunM?.toString() ?? '');
    final meterLocationCtrl = TextEditingController(text: _job?.meterLocation ?? '');

    // Site survey dropdowns
    String roofType = _job?.roofType ?? '';
    String roofCondition = _job?.roofCondition ?? '';
    String mountingType = _job?.mountingType ?? '';
    String shading = _job?.shading ?? '';
    String earthingType = _job?.earthingType ?? '';
    String wiringCondition = _job?.wiringCondition ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 16,
            right: 16,
            top: 16,
          ),
          child: SizedBox(
            height: MediaQuery.of(ctx).size.height * 0.85,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Edit Job',
                      style: Theme.of(ctx).textTheme.titleMedium),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: systemType,
                    decoration:
                        const InputDecoration(labelText: 'System Type'),
                    items: const [
                      'On-grid',
                      'Hybrid',
                      'Off-grid',
                      'Inverter & Battery',
                      'Solar Water Heater',
                    ]
                        .map((t) =>
                            DropdownMenuItem(value: t, child: Text(t)))
                        .toList(),
                    onChanged: (v) {
                      if (v != null) {
                        setSheetState(() => systemType = v);
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: capacityCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration:
                        const InputDecoration(labelText: 'Capacity (kW)'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: locationCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Location'),
                    textCapitalization: TextCapitalization.sentences,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notesCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'Notes'),
                    textCapitalization: TextCapitalization.sentences,
                  ),

                  // ── Site Survey: Roof & Structure ──
                  const SizedBox(height: 20),
                  Text('Roof & Structure', style: Theme.of(ctx).textTheme.titleSmall),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: roofType.isEmpty ? null : roofType,
                    decoration: const InputDecoration(labelText: 'Roof Type'),
                    items: ['Flat', 'Tiled', 'Metal Sheet', 'RCC', 'Ground']
                        .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                        .toList(),
                    onChanged: (v) => setSheetState(() => roofType = v ?? ''),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: roofAreaCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Roof Area (sq ft)'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: roofCondition.isEmpty ? null : roofCondition,
                    decoration: const InputDecoration(labelText: 'Roof Condition'),
                    items: ['Good', 'Fair', 'Poor']
                        .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                        .toList(),
                    onChanged: (v) => setSheetState(() => roofCondition = v ?? ''),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: numFloorsCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Number of Floors'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: buildingHeightCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Building Height (m)'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: mountingType.isEmpty ? null : mountingType,
                    decoration: const InputDecoration(labelText: 'Mounting Type'),
                    items: ['Flush', 'Tilt', 'Ground']
                        .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                        .toList(),
                    onChanged: (v) => setSheetState(() => mountingType = v ?? ''),
                  ),

                  // ── Site Survey: Solar Parameters ──
                  const SizedBox(height: 20),
                  Text('Solar Parameters', style: Theme.of(ctx).textTheme.titleSmall),
                  const SizedBox(height: 12),
                  TextField(
                    controller: azimuthCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Azimuth (0-360\u00B0)'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: tiltCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Tilt (0-90\u00B0)'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: recCapacityCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Recommended Capacity (kW)'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: recPanelCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Recommended Panel Count'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: recInverterCtrl,
                    decoration: const InputDecoration(labelText: 'Recommended Inverter'),
                    textCapitalization: TextCapitalization.sentences,
                  ),

                  // ── Site Survey: Shading ──
                  const SizedBox(height: 20),
                  Text('Shading', style: Theme.of(ctx).textTheme.titleSmall),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: shading.isEmpty ? null : shading,
                    decoration: const InputDecoration(labelText: 'Shading'),
                    items: ['None', 'Partial', 'Significant']
                        .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                        .toList(),
                    onChanged: (v) => setSheetState(() => shading = v ?? ''),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: obstructionCtrl,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: 'Obstruction Notes'),
                    textCapitalization: TextCapitalization.sentences,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: cableRunCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Cable Run (m)'),
                  ),

                  // ── Site Survey: Electrical ──
                  const SizedBox(height: 20),
                  Text('Electrical', style: Theme.of(ctx).textTheme.titleSmall),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: earthingType.isEmpty ? null : earthingType,
                    decoration: const InputDecoration(labelText: 'Earthing Type'),
                    items: ['Pipe', 'Plate', 'Strip', 'None']
                        .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                        .toList(),
                    onChanged: (v) => setSheetState(() => earthingType = v ?? ''),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: meterLocationCtrl,
                    decoration: const InputDecoration(labelText: 'Meter Location'),
                    textCapitalization: TextCapitalization.sentences,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: wiringCondition.isEmpty ? null : wiringCondition,
                    decoration: const InputDecoration(labelText: 'Wiring Condition'),
                    items: ['Good', 'Fair', 'Poor']
                        .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                        .toList(),
                    onChanged: (v) => setSheetState(() => wiringCondition = v ?? ''),
                  ),

                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      _saveJobEdit(
                        systemType: systemType,
                        capacityKw:
                            double.tryParse(capacityCtrl.text.trim()),
                        location: locationCtrl.text.trim(),
                        notes: notesCtrl.text.trim(),
                        roofType: roofType,
                        roofAreaSqft: double.tryParse(roofAreaCtrl.text.trim()),
                        roofCondition: roofCondition,
                        numFloors: int.tryParse(numFloorsCtrl.text.trim()),
                        buildingHeightM: double.tryParse(buildingHeightCtrl.text.trim()),
                        mountingType: mountingType,
                        azimuthDeg: double.tryParse(azimuthCtrl.text.trim()),
                        tiltDeg: double.tryParse(tiltCtrl.text.trim()),
                        recommendedCapacityKw: double.tryParse(recCapacityCtrl.text.trim()),
                        recommendedPanelCount: int.tryParse(recPanelCtrl.text.trim()),
                        recommendedInverter: recInverterCtrl.text.trim(),
                        shading: shading,
                        obstructionNotes: obstructionCtrl.text.trim(),
                        cableRunM: double.tryParse(cableRunCtrl.text.trim()),
                        earthingType: earthingType,
                        meterLocation: meterLocationCtrl.text.trim(),
                        wiringCondition: wiringCondition,
                      );
                    },
                    child: const Text('Save'),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _saveJobEdit({
    required String systemType,
    double? capacityKw,
    required String location,
    required String notes,
    String roofType = '',
    double? roofAreaSqft,
    String roofCondition = '',
    int? numFloors,
    double? buildingHeightM,
    String mountingType = '',
    double? azimuthDeg,
    double? tiltDeg,
    double? recommendedCapacityKw,
    int? recommendedPanelCount,
    String recommendedInverter = '',
    String shading = '',
    String obstructionNotes = '',
    double? cableRunM,
    String earthingType = '',
    String meterLocation = '',
    String wiringCondition = '',
  }) async {
    try {
      await widget.repository.updateJob(widget.jobId, {
        'system_type': systemType,
        if (capacityKw != null) 'capacity_kw': capacityKw,
        'location': location.isEmpty ? null : location,
        'notes': notes.isEmpty ? null : notes,
        'roof_type': roofType.isEmpty ? null : roofType,
        'roof_area_sqft': roofAreaSqft,
        'roof_condition': roofCondition.isEmpty ? null : roofCondition,
        'num_floors': numFloors,
        'building_height_m': buildingHeightM,
        'mounting_type': mountingType.isEmpty ? null : mountingType,
        'azimuth_deg': azimuthDeg,
        'tilt_deg': tiltDeg,
        'recommended_capacity_kw': recommendedCapacityKw,
        'recommended_panel_count': recommendedPanelCount,
        'recommended_inverter': recommendedInverter.isEmpty ? null : recommendedInverter,
        'shading': shading.isEmpty ? null : shading,
        'obstruction_notes': obstructionNotes.isEmpty ? null : obstructionNotes,
        'cable_run_m': cableRunM,
        'earthing_type': earthingType.isEmpty ? null : earthingType,
        'meter_location': meterLocation.isEmpty ? null : meterLocation,
        'wiring_condition': wiringCondition.isEmpty ? null : wiringCondition,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Job updated'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: $e'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.red.shade600,
          ),
        );
      }
    }
  }

  void _showAddTaskDialog() {
    final titleCtrl = TextEditingController();
    DateTime? dueDate;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Add Task'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(labelText: 'Task title'),
                textCapitalization: TextCapitalization.sentences,
                autofocus: true,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      dueDate != null
                          ? 'Due: ${DateFormat('dd MMM yyyy').format(dueDate!)}'
                          : 'No due date',
                      style: Theme.of(ctx).textTheme.bodySmall,
                    ),
                  ),
                  TextButton(
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: ctx,
                        initialDate:
                            dueDate ?? DateTime.now().add(const Duration(days: 3)),
                        firstDate: DateTime.now(),
                        lastDate:
                            DateTime.now().add(const Duration(days: 365)),
                      );
                      if (picked != null) {
                        setDialogState(() => dueDate = picked);
                      }
                    },
                    child: const Text('Pick date'),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () async {
                final title = titleCtrl.text.trim();
                if (title.isEmpty) return;
                Navigator.pop(ctx);
                try {
                  final dueDateStr = dueDate != null
                      ? '${dueDate!.year.toString().padLeft(4, '0')}-${dueDate!.month.toString().padLeft(2, '0')}-${dueDate!.day.toString().padLeft(2, '0')}'
                      : null;
                  await widget.repository.createTask({
                    'job_id': widget.jobId,
                    'title': title,
                    if (dueDateStr != null) 'due_date': dueDateStr,
                  });
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Task created'),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  }
                  await _load();
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Failed: $e'),
                        behavior: SnackBarBehavior.floating,
                        backgroundColor: Colors.red.shade600,
                      ),
                    );
                  }
                }
              },
              child: const Text('Add'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Job Details'),
        actions: [
          IconButton(
            tooltip: 'Edit Job',
            onPressed: _job == null ? null : _showEditSheet,
            icon: const Icon(Icons.edit_rounded),
          ),
          if (widget.config != null)
            IconButton(
              tooltip: 'Update Status',
              onPressed: _job == null ? null : _showStatusSheet,
              icon: const Icon(Icons.swap_horiz_rounded),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _job == null
              ? Center(
                  child: Text('Job not found', style: theme.textTheme.bodyLarge),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _buildBody(theme),
                ),
    );
  }

  Widget _buildBody(ThemeData theme) {
    final job = _job!;
    final custName = job.customerName ?? 'Unknown Customer';

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        // Header
        Text(custName, style: theme.textTheme.headlineSmall),
        const SizedBox(height: 4),
        Row(
          children: [
            if (job.systemType != null) ...[
              Text(job.systemType!, style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              )),
              if (job.capacityKw != null) Text(' · ${job.capacityKw} kW',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 16),

        // Pipeline stepper
        _PipelineStepper(currentStatus: job.status ?? 'Lead'),
        const SizedBox(height: 20),

        // Customer info
        if (_customer != null) ...[
          _SectionTitle(title: 'Customer'),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                if (_customer!.phone != null)
                  ListTile(
                    leading: const Icon(Icons.phone_outlined),
                    title: Text(_customer!.phone!),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          onPressed: () => makePhoneCall(_customer!.phone!),
                          icon: Icon(Icons.phone_rounded, color: Colors.green.shade600),
                          tooltip: 'Call',
                        ),
                        IconButton(
                          onPressed: () => openWhatsApp(_customer!.phone!),
                          icon: const Icon(Icons.message_rounded, color: Color(0xFF25D366)),
                          tooltip: 'WhatsApp',
                        ),
                      ],
                    ),
                  ),
                if (_customer!.email != null) ...[
                  const Divider(indent: 56),
                  ListTile(
                    leading: const Icon(Icons.email_outlined),
                    title: Text(_customer!.email!),
                  ),
                ],
                if (_customer!.address != null) ...[
                  const Divider(indent: 56),
                  ListTile(
                    leading: const Icon(Icons.location_on_outlined),
                    title: Text(_customer!.address!),
                  ),
                ],
                if (_customer!.discom != null || _customer!.consumerNo != null) ...[
                  const Divider(indent: 56),
                  ListTile(
                    leading: const Icon(Icons.electrical_services_outlined),
                    title: Text([
                      if (_customer!.discom != null) _customer!.discom!,
                      if (_customer!.consumerNo != null) 'No: ${_customer!.consumerNo!}',
                    ].join(' · ')),
                    subtitle: _customer!.sanctionedLoadKw != null
                        ? Text('Sanctioned: ${_customer!.sanctionedLoadKw} kW')
                        : null,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),
        ],

        // Financial summary
        if (job.totalAmount != null || job.quotedPrice != null) ...[
          _SectionTitle(title: 'Financial'),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  if (job.quotedPrice != null)
                    _FinancialRow(label: 'Quoted Price', amount: job.quotedPrice!),
                  if (job.totalAmount != null)
                    _FinancialRow(label: 'Total Amount', amount: job.totalAmount!, bold: true),
                  if (job.depositAmount != null)
                    _FinancialRow(label: 'Deposit', amount: job.depositAmount!),
                  if (job.balanceDue != null)
                    _FinancialRow(
                      label: 'Balance Due',
                      amount: job.balanceDue!,
                      color: job.balanceDue! > 0 ? Colors.red.shade600 : Colors.green.shade600,
                    ),
                  if (job.isLoan)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          Icon(Icons.account_balance_outlined, size: 16,
                              color: theme.colorScheme.primary),
                          const SizedBox(width: 6),
                          Text('Loan Financed',
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: theme.colorScheme.primary,
                              )),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],

        // Key dates
        _SectionTitle(title: 'Key Dates'),
        const SizedBox(height: 8),
        Card(
          child: Column(
            children: [
              if (job.dateLead != null)
                _DateTile(label: 'Lead Date', date: job.dateLead!),
              if (job.dateWon != null) ...[
                const Divider(indent: 56),
                _DateTile(label: 'Won', date: job.dateWon!),
              ],
              if (job.dateInstall != null) ...[
                const Divider(indent: 56),
                _DateTile(label: 'Installation', date: job.dateInstall!),
              ],
              if (job.dateHandover != null) ...[
                const Divider(indent: 56),
                _DateTile(label: 'Handover', date: job.dateHandover!),
              ],
              if (job.dateLead == null && job.dateWon == null &&
                  job.dateInstall == null && job.dateHandover == null)
                const ListTile(
                  leading: Icon(Icons.event_outlined),
                  title: Text('No dates recorded'),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Tasks
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _SectionTitle(title: 'Tasks (${_tasks.length})'),
            TextButton.icon(
              onPressed: _showAddTaskDialog,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (_tasks.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'No tasks for this job.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          )
        else
          Card(
            child: Column(
              children: [
                for (int i = 0; i < _tasks.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _TaskTile(task: _tasks[i], onToggle: () => _toggleTask(_tasks[i])),
                ],
              ],
            ),
          ),

        // Site Survey
        if (job.hasSurveyData) ...[
          const SizedBox(height: 20),
          _SectionTitle(title: 'Site Survey'),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Roof & Structure
                  if (job.roofType != null || job.roofAreaSqft != null ||
                      job.roofCondition != null || job.numFloors != null ||
                      job.buildingHeightM != null || job.mountingType != null) ...[
                    Text('Roof & Structure', style: theme.textTheme.labelLarge),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        if (job.roofType != null) _SurveyChip(label: 'Roof Type', value: job.roofType!),
                        if (job.roofAreaSqft != null) _SurveyChip(label: 'Area', value: '${job.roofAreaSqft} sq ft'),
                        if (job.roofCondition != null) _SurveyChip(label: 'Condition', value: job.roofCondition!),
                        if (job.numFloors != null) _SurveyChip(label: 'Floors', value: '${job.numFloors}'),
                        if (job.buildingHeightM != null) _SurveyChip(label: 'Height', value: '${job.buildingHeightM} m'),
                        if (job.mountingType != null) _SurveyChip(label: 'Mounting', value: job.mountingType!),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                  // Solar Parameters
                  if (job.azimuthDeg != null || job.tiltDeg != null ||
                      job.recommendedCapacityKw != null || job.recommendedPanelCount != null ||
                      job.recommendedInverter != null) ...[
                    Text('Solar Parameters', style: theme.textTheme.labelLarge),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        if (job.azimuthDeg != null) _SurveyChip(label: 'Azimuth', value: '${job.azimuthDeg}\u00B0'),
                        if (job.tiltDeg != null) _SurveyChip(label: 'Tilt', value: '${job.tiltDeg}\u00B0'),
                        if (job.recommendedCapacityKw != null) _SurveyChip(label: 'Rec. Capacity', value: '${job.recommendedCapacityKw} kW'),
                        if (job.recommendedPanelCount != null) _SurveyChip(label: 'Panels', value: '${job.recommendedPanelCount}'),
                        if (job.recommendedInverter != null) _SurveyChip(label: 'Inverter', value: job.recommendedInverter!),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                  // Shading
                  if (job.shading != null || job.obstructionNotes != null || job.cableRunM != null) ...[
                    Text('Shading', style: theme.textTheme.labelLarge),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        if (job.shading != null) _SurveyChip(label: 'Shading', value: job.shading!),
                        if (job.cableRunM != null) _SurveyChip(label: 'Cable Run', value: '${job.cableRunM} m'),
                      ],
                    ),
                    if (job.obstructionNotes != null) ...[
                      const SizedBox(height: 6),
                      Text('Obstructions: ${job.obstructionNotes}', style: theme.textTheme.bodySmall),
                    ],
                    const SizedBox(height: 12),
                  ],
                  // Electrical
                  if (job.earthingType != null || job.meterLocation != null || job.wiringCondition != null) ...[
                    Text('Electrical', style: theme.textTheme.labelLarge),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        if (job.earthingType != null) _SurveyChip(label: 'Earthing', value: job.earthingType!),
                        if (job.meterLocation != null) _SurveyChip(label: 'Meter', value: job.meterLocation!),
                        if (job.wiringCondition != null) _SurveyChip(label: 'Wiring', value: job.wiringCondition!),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],

        // Notes
        if (job.notes != null && job.notes!.isNotEmpty) ...[
          const SizedBox(height: 20),
          _SectionTitle(title: 'Notes'),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(job.notes!, style: theme.textTheme.bodyMedium),
            ),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Pipeline Stepper
// ---------------------------------------------------------------------------

class _PipelineStepper extends StatelessWidget {
  const _PipelineStepper({required this.currentStatus});

  final String currentStatus;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currentIndex = _pipelineStages.indexOf(currentStatus);
    final isLost = currentStatus == 'Lost';

    return SizedBox(
      height: 56,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: _pipelineStages.length,
        itemBuilder: (context, index) {
          final stage = _pipelineStages[index];
          final isActive = index == currentIndex;
          final isPast = currentIndex >= 0 && index < currentIndex;

          Color bgColor;
          Color textColor;
          if (isLost) {
            bgColor = isActive ? Colors.red.shade100 : theme.colorScheme.surfaceContainerLow;
            textColor = isActive ? Colors.red.shade700 : theme.colorScheme.onSurfaceVariant;
          } else if (isActive) {
            bgColor = theme.colorScheme.primary;
            textColor = theme.colorScheme.onPrimary;
          } else if (isPast) {
            bgColor = theme.colorScheme.primary.withValues(alpha: 0.15);
            textColor = theme.colorScheme.primary;
          } else {
            bgColor = theme.colorScheme.surfaceContainerLow;
            textColor = theme.colorScheme.onSurfaceVariant;
          }

          return Padding(
            padding: EdgeInsets.only(right: index < _pipelineStages.length - 1 ? 6 : 0),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Center(
                child: Text(
                  stage.replaceAll('_', '\n'),
                  textAlign: TextAlign.center,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: textColor,
                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    fontSize: 10,
                    height: 1.2,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Section & helper widgets
// ---------------------------------------------------------------------------

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: Theme.of(context).textTheme.titleSmall?.copyWith(
        color: Theme.of(context).colorScheme.onSurfaceVariant,
        letterSpacing: 0.5,
      ),
    );
  }
}

class _FinancialRow extends StatelessWidget {
  const _FinancialRow({
    required this.label,
    required this.amount,
    this.bold = false,
    this.color,
  });

  final String label;
  final double amount;
  final bool bold;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final formatted = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '\u20B9',
      decimalDigits: 0,
    ).format(amount);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          )),
          Text(
            formatted,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _DateTile extends StatelessWidget {
  const _DateTile({required this.label, required this.date});

  final String label;
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: const Icon(Icons.event_outlined),
      title: Text(label),
      trailing: Text(
        DateFormat('dd MMM yyyy').format(date),
        style: Theme.of(context).textTheme.bodyMedium,
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({required this.task, required this.onToggle});

  final TaskItem task;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final priorityColor = _priorityColor(task.priority);

    return ListTile(
      leading: Checkbox(
        value: task.isDone,
        onChanged: (_) => onToggle(),
        activeColor: theme.colorScheme.primary,
      ),
      title: Text(
        task.title ?? 'Untitled Task',
        style: TextStyle(
          decoration: task.isDone ? TextDecoration.lineThrough : null,
          color: task.isDone
              ? theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5)
              : null,
        ),
      ),
      subtitle: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            decoration: BoxDecoration(
              color: priorityColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              task.priority,
              style: theme.textTheme.labelSmall?.copyWith(
                color: priorityColor,
                fontWeight: FontWeight.w600,
                fontSize: 10,
              ),
            ),
          ),
          if (task.dueDate != null) ...[
            const SizedBox(width: 8),
            Text(
              DateFormat('dd MMM').format(task.dueDate!),
              style: theme.textTheme.labelSmall?.copyWith(
                color: task.isOverdue ? Colors.red.shade600 : theme.colorScheme.onSurfaceVariant,
                fontWeight: task.isOverdue ? FontWeight.w600 : null,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SurveyChip extends StatelessWidget {
  const _SurveyChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
            fontSize: 10,
          )),
          Text(value, style: theme.textTheme.bodySmall?.copyWith(
            fontWeight: FontWeight.w600,
          )),
        ],
      ),
    );
  }
}

Color _priorityColor(String priority) {
  switch (priority) {
    case 'Urgent':
      return Colors.red.shade700;
    case 'High':
      return Colors.orange.shade700;
    case 'Medium':
      return Colors.blue.shade600;
    case 'Low':
      return Colors.grey.shade600;
    default:
      return Colors.grey.shade600;
  }
}
