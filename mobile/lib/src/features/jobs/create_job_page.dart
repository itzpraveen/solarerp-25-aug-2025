import 'dart:async';

import 'package:flutter/material.dart';

import '../../config/app_config.dart';
import '../../data/models.dart';
import '../../data/solarerp_repository.dart';

const List<String> _systemTypes = [
  'On-grid',
  'Hybrid',
  'Off-grid',
  'Inverter & Battery',
  'Solar Water Heater',
];

class CreateJobPage extends StatefulWidget {
  const CreateJobPage({
    super.key,
    required this.repository,
    required this.config,
  });

  final SolarErpRepository repository;
  final AppConfig config;

  @override
  State<CreateJobPage> createState() => _CreateJobPageState();
}

class _CreateJobPageState extends State<CreateJobPage> {
  final _formKey = GlobalKey<FormState>();
  final _customerSearchCtrl = TextEditingController();
  final _capacityCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  Customer? _selectedCustomer;
  List<Customer> _customerResults = const [];
  bool _searchingCustomers = false;
  Timer? _searchDebounce;
  String? _systemType;
  bool _saving = false;

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _customerSearchCtrl.dispose();
    _capacityCtrl.dispose();
    _locationCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  void _onCustomerSearchChanged(String query) {
    _searchDebounce?.cancel();
    if (query.trim().length < 2) {
      setState(() => _customerResults = const []);
      return;
    }
    _searchDebounce = Timer(const Duration(milliseconds: 300), () async {
      setState(() => _searchingCustomers = true);
      try {
        final results = await widget.repository.searchCustomers(query.trim());
        if (mounted) {
          setState(() {
            _customerResults = results;
            _searchingCustomers = false;
          });
        }
      } catch (_) {
        if (mounted) setState(() => _searchingCustomers = false);
      }
    });
  }

  void _selectCustomer(Customer customer) {
    setState(() {
      _selectedCustomer = customer;
      _customerSearchCtrl.text = customer.name ?? '';
      _customerResults = const [];
      if (customer.address != null && _locationCtrl.text.isEmpty) {
        _locationCtrl.text = customer.address!;
      }
    });
  }

  void _clearCustomer() {
    setState(() {
      _selectedCustomer = null;
      _customerSearchCtrl.clear();
      _customerResults = const [];
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCustomer == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a customer'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final data = <String, dynamic>{
        'customer_id': _selectedCustomer!.id,
        'system_type': _systemType ?? 'On-grid',
      };
      if (_capacityCtrl.text.trim().isNotEmpty) {
        final kw = double.tryParse(_capacityCtrl.text.trim());
        if (kw != null) data['capacity_kw'] = kw;
      }
      if (_locationCtrl.text.trim().isNotEmpty) {
        data['location'] = _locationCtrl.text.trim();
      }
      if (_notesCtrl.text.trim().isNotEmpty) {
        data['notes'] = _notesCtrl.text.trim();
      }

      await widget.repository.createJob(data);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Job created'), behavior: SnackBarBehavior.floating),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to create job: $e'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.red.shade600,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('New Job')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Customer picker
            if (_selectedCustomer != null)
              Card(
                child: ListTile(
                  leading: CircleAvatar(
                    child: Text(
                      (_selectedCustomer!.name ?? '?')[0].toUpperCase(),
                    ),
                  ),
                  title: Text(_selectedCustomer!.name ?? 'Unknown'),
                  subtitle: Text(_selectedCustomer!.phone ?? ''),
                  trailing: IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: _clearCustomer,
                  ),
                ),
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _customerSearchCtrl,
                    onChanged: _onCustomerSearchChanged,
                    decoration: InputDecoration(
                      labelText: 'Search Customer *',
                      prefixIcon: const Icon(Icons.person_search_outlined),
                      suffixIcon: _searchingCustomers
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          : null,
                    ),
                  ),
                  if (_customerResults.isNotEmpty)
                    Card(
                      margin: const EdgeInsets.only(top: 4),
                      child: Column(
                        children: _customerResults.map((c) {
                          return ListTile(
                            dense: true,
                            title: Text(c.name ?? 'Unknown'),
                            subtitle: c.phone != null ? Text(c.phone!) : null,
                            onTap: () => _selectCustomer(c),
                          );
                        }).toList(),
                      ),
                    ),
                  if (_customerSearchCtrl.text.trim().length >= 2 &&
                      _customerResults.isEmpty &&
                      !_searchingCustomers)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        'No customers found. Create one from the web app first.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                ],
              ),
            const SizedBox(height: 16),

            // System type
            DropdownButtonFormField<String>(
              initialValue: _systemType,
              decoration: const InputDecoration(
                labelText: 'System Type *',
                prefixIcon: Icon(Icons.solar_power_outlined),
              ),
              items: _systemTypes
                  .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                  .toList(),
              onChanged: (v) => setState(() => _systemType = v),
              validator: (v) => (v == null || v.isEmpty) ? 'Select system type' : null,
            ),
            const SizedBox(height: 12),

            // Capacity
            TextFormField(
              controller: _capacityCtrl,
              decoration: const InputDecoration(
                labelText: 'Capacity (kW)',
                prefixIcon: Icon(Icons.bolt_outlined),
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),

            // Location
            TextFormField(
              controller: _locationCtrl,
              decoration: const InputDecoration(
                labelText: 'Location',
                prefixIcon: Icon(Icons.location_on_outlined),
              ),
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 12),

            // Notes
            TextFormField(
              controller: _notesCtrl,
              decoration: const InputDecoration(
                labelText: 'Notes',
                prefixIcon: Icon(Icons.notes_rounded),
                alignLabelWithHint: true,
              ),
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 24),

            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.add),
              label: Text(_saving ? 'Creating...' : 'Create Job'),
            ),
          ],
        ),
      ),
    );
  }
}
