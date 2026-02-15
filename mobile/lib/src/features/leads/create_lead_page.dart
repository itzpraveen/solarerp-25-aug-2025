import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../data/solarerp_repository.dart';

const List<String> _sources = [
  'Referral',
  'Inbound',
  'Website',
  'Google',
  'Walk-in',
  'Facebook',
  'Cold Call',
  'Other',
];

class CreateLeadPage extends StatefulWidget {
  const CreateLeadPage({super.key, required this.repository});

  final SolarErpRepository repository;

  @override
  State<CreateLeadPage> createState() => _CreateLeadPageState();
}

class _CreateLeadPageState extends State<CreateLeadPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _capacityCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String? _source;
  DateTime? _followUpDate;
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    _capacityCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickFollowUpDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _followUpDate ?? now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365 * 2)),
    );
    if (picked != null) {
      setState(() => _followUpDate = picked);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final data = <String, dynamic>{
        'name': _nameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'status': 'New',
      };
      if (_emailCtrl.text.trim().isNotEmpty) {
        data['email'] = _emailCtrl.text.trim();
      }
      if (_addressCtrl.text.trim().isNotEmpty) {
        data['address'] = _addressCtrl.text.trim();
      }
      if (_source != null) {
        data['source'] = _source;
      }
      if (_capacityCtrl.text.trim().isNotEmpty) {
        final kw = double.tryParse(_capacityCtrl.text.trim());
        if (kw != null) data['interested_capacity_kw'] = kw;
      }
      if (_followUpDate != null) {
        data['next_follow_up_date'] = DateFormat('yyyy-MM-dd').format(_followUpDate!);
      }
      if (_notesCtrl.text.trim().isNotEmpty) {
        data['notes'] = _notesCtrl.text.trim();
      }

      await widget.repository.createLead(data);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lead created'), behavior: SnackBarBehavior.floating),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to create lead: $e'),
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
    return Scaffold(
      appBar: AppBar(title: const Text('New Lead')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Name *',
                prefixIcon: Icon(Icons.person_outline),
              ),
              textCapitalization: TextCapitalization.words,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phoneCtrl,
              decoration: const InputDecoration(
                labelText: 'Phone *',
                prefixIcon: Icon(Icons.phone_outlined),
              ),
              keyboardType: TextInputType.phone,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Phone is required';
                if (v.trim().length < 10) return 'Enter a valid phone number';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _emailCtrl,
              decoration: const InputDecoration(
                labelText: 'Email',
                prefixIcon: Icon(Icons.email_outlined),
              ),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _addressCtrl,
              decoration: const InputDecoration(
                labelText: 'Address',
                prefixIcon: Icon(Icons.location_on_outlined),
              ),
              textCapitalization: TextCapitalization.sentences,
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _source,
              decoration: const InputDecoration(
                labelText: 'Source',
                prefixIcon: Icon(Icons.source_outlined),
              ),
              items: _sources
                  .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                  .toList(),
              onChanged: (v) => setState(() => _source = v),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _capacityCtrl,
              decoration: const InputDecoration(
                labelText: 'Interested Capacity (kW)',
                prefixIcon: Icon(Icons.solar_power_outlined),
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.calendar_today_rounded),
              title: Text(
                _followUpDate != null
                    ? 'Follow-up: ${DateFormat('dd MMM yyyy').format(_followUpDate!)}'
                    : 'Set follow-up date',
                style: TextStyle(
                  color: _followUpDate != null ? null : Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              trailing: _followUpDate != null
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () => setState(() => _followUpDate = null),
                    )
                  : null,
              onTap: _pickFollowUpDate,
            ),
            const SizedBox(height: 12),
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
              label: Text(_saving ? 'Creating...' : 'Create Lead'),
            ),
          ],
        ),
      ),
    );
  }
}
