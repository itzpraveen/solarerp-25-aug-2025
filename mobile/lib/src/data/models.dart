class UserProfile {
  const UserProfile({
    required this.userId,
    required this.tenantId,
    required this.role,
    this.displayName,
    this.username,
  });

  final String userId;
  final String tenantId;
  final String role;
  final String? displayName;
  final String? username;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      userId: _asString(json['user_id']),
      tenantId: _asString(json['tenant_id']),
      role: _asString(json['role']),
      displayName: _asNullableString(json['display_name']),
      username: _asNullableString(json['username']),
    );
  }
}

class Branch {
  const Branch({required this.id, required this.name});

  final String id;
  final String name;

  factory Branch.fromJson(Map<String, dynamic> json) {
    return Branch(id: _asString(json['id']), name: _asString(json['name']));
  }
}

class OverviewKpi {
  const OverviewKpi({
    required this.total,
    required this.open,
    required this.dueToday,
    required this.overdue,
    required this.newWeek,
    required this.converted,
    required this.leadsNewMonth,
    required this.leadsConvertedMonth,
    required this.proposalsWeek,
    required this.proposalsMonth,
  });

  final int total;
  final int open;
  final int dueToday;
  final int overdue;
  final int newWeek;
  final int converted;
  final int leadsNewMonth;
  final int leadsConvertedMonth;
  final int proposalsWeek;
  final int proposalsMonth;

  factory OverviewKpi.fromRpcRow(Map<String, dynamic> row) {
    return OverviewKpi(
      total: _asInt(row['total']),
      open: _asInt(row['open']),
      dueToday: _asInt(row['due_today']),
      overdue: _asInt(row['overdue']),
      newWeek: _asInt(row['new_week']),
      converted: _asInt(row['converted_total']),
      leadsNewMonth: _asInt(row['leads_new_month']),
      leadsConvertedMonth: _asInt(row['leads_converted_month']),
      proposalsWeek: _asInt(row['proposals_week']),
      proposalsMonth: _asInt(row['proposals_month']),
    );
  }
}

class LeadSummary {
  const LeadSummary({
    required this.id,
    required this.name,
    required this.phone,
    required this.status,
    required this.source,
    required this.branchId,
    required this.score,
    required this.date,
    required this.nextFollowUpDate,
  });

  final String id;
  final String? name;
  final String? phone;
  final String? status;
  final String? source;
  final String? branchId;
  final int score;
  final DateTime? date;
  final DateTime? nextFollowUpDate;

  factory LeadSummary.fromJson(Map<String, dynamic> json) {
    return LeadSummary(
      id: _asString(json['id']),
      name: _asNullableString(json['name']),
      phone: _asNullableString(json['phone']),
      status: _asNullableString(json['status']),
      source: _asNullableString(json['source']),
      branchId: _asNullableString(json['branch_id']),
      score: _asInt(json['score']),
      date: _parseDate(json['date']),
      nextFollowUpDate: _parseDate(json['next_follow_up_date']),
    );
  }

  LeadSummary copyWith({
    String? status,
    DateTime? nextFollowUpDate,
  }) {
    return LeadSummary(
      id: id,
      name: name,
      phone: phone,
      status: status ?? this.status,
      source: source,
      branchId: branchId,
      score: score,
      date: date,
      nextFollowUpDate: nextFollowUpDate ?? this.nextFollowUpDate,
    );
  }

  bool get isOverdue {
    if (nextFollowUpDate == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return nextFollowUpDate!.isBefore(today) && !_isClosedStatus(status);
  }

  bool get isDueToday {
    if (nextFollowUpDate == null) return false;
    final now = DateTime.now();
    return nextFollowUpDate!.year == now.year &&
        nextFollowUpDate!.month == now.month &&
        nextFollowUpDate!.day == now.day &&
        !_isClosedStatus(status);
  }

  String get normalizedStatus => (status ?? '').trim().toLowerCase();

  bool get isConverted => normalizedStatus == 'converted';

  bool get isLost => normalizedStatus == 'lost';

  bool get isClosed => normalizedStatus == 'closed';

  bool get isOpen => !isConverted && !isLost && !isClosed;
}

bool _isClosedStatus(String? status) {
  final normalized = (status ?? '').toLowerCase();
  return normalized == 'closed' ||
      normalized == 'converted' ||
      normalized == 'lost';
}

String _asString(dynamic value) {
  if (value == null) return '';
  return value.toString();
}

String? _asNullableString(dynamic value) {
  if (value == null) return null;
  final out = value.toString().trim();
  return out.isEmpty ? null : out;
}

int _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

double _asDouble(dynamic value) {
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? 0.0;
  return 0.0;
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  final raw = value.toString();
  if (raw.isEmpty) return null;
  return DateTime.tryParse(raw);
}

// ---------------------------------------------------------------------------
// Lead Detail (full lead with all fields)
// ---------------------------------------------------------------------------

class LeadDetail {
  const LeadDetail({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    required this.address,
    required this.status,
    required this.source,
    required this.branchId,
    required this.score,
    required this.scoreBreakdown,
    required this.date,
    required this.nextFollowUpDate,
    required this.lastContactedAt,
    required this.interestedCapacityKw,
    required this.notes,
    required this.assignedTo,
  });

  final String id;
  final String? name;
  final String? phone;
  final String? email;
  final String? address;
  final String? status;
  final String? source;
  final String? branchId;
  final int score;
  final Map<String, dynamic>? scoreBreakdown;
  final DateTime? date;
  final DateTime? nextFollowUpDate;
  final DateTime? lastContactedAt;
  final double? interestedCapacityKw;
  final String? notes;
  final String? assignedTo;

  factory LeadDetail.fromJson(Map<String, dynamic> json) {
    final rawBreakdown = json['score_breakdown'];
    Map<String, dynamic>? breakdown;
    if (rawBreakdown is Map) {
      breakdown = Map<String, dynamic>.from(rawBreakdown);
    }
    final rawCapacity = json['interested_capacity_kw'];
    double? capacity;
    if (rawCapacity != null) {
      capacity = _asDouble(rawCapacity);
    }
    return LeadDetail(
      id: _asString(json['id']),
      name: _asNullableString(json['name']),
      phone: _asNullableString(json['phone']),
      email: _asNullableString(json['email']),
      address: _asNullableString(json['address']),
      status: _asNullableString(json['status']),
      source: _asNullableString(json['source']),
      branchId: _asNullableString(json['branch_id']),
      score: _asInt(json['score']),
      scoreBreakdown: breakdown,
      date: _parseDate(json['date']),
      nextFollowUpDate: _parseDate(json['next_follow_up_date']),
      lastContactedAt: _parseDate(json['last_contacted_at']),
      interestedCapacityKw: capacity,
      notes: _asNullableString(json['notes']),
      assignedTo: _asNullableString(json['assigned_to']),
    );
  }

  bool get isOverdue {
    if (nextFollowUpDate == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return nextFollowUpDate!.isBefore(today) && !_isClosedStatus(status);
  }

  bool get isDueToday {
    if (nextFollowUpDate == null) return false;
    final now = DateTime.now();
    return nextFollowUpDate!.year == now.year &&
        nextFollowUpDate!.month == now.month &&
        nextFollowUpDate!.day == now.day &&
        !_isClosedStatus(status);
  }
}

// ---------------------------------------------------------------------------
// Job Summary (list view)
// ---------------------------------------------------------------------------

class JobSummary {
  const JobSummary({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.systemType,
    required this.capacityKw,
    required this.status,
    required this.quotedPrice,
    required this.totalAmount,
    required this.depositAmount,
    required this.balanceDue,
    required this.location,
    required this.notes,
    required this.dateLead,
    required this.dateWon,
    required this.dateInstall,
    required this.dateHandover,
    required this.branchId,
    required this.programType,
    required this.isLoan,
    required this.createdAt,
    // Site survey fields
    required this.roofType,
    required this.roofAreaSqft,
    required this.roofCondition,
    required this.numFloors,
    required this.buildingHeightM,
    required this.mountingType,
    required this.azimuthDeg,
    required this.tiltDeg,
    required this.recommendedCapacityKw,
    required this.recommendedPanelCount,
    required this.recommendedInverter,
    required this.shading,
    required this.obstructionNotes,
    required this.cableRunM,
    required this.earthingType,
    required this.meterLocation,
    required this.wiringCondition,
  });

  final String id;
  final String customerId;
  final String? customerName;
  final String? customerPhone;
  final String? systemType;
  final double? capacityKw;
  final String? status;
  final double? quotedPrice;
  final double? totalAmount;
  final double? depositAmount;
  final double? balanceDue;
  final String? location;
  final String? notes;
  final DateTime? dateLead;
  final DateTime? dateWon;
  final DateTime? dateInstall;
  final DateTime? dateHandover;
  final String? branchId;
  final String? programType;
  final bool isLoan;
  final DateTime? createdAt;

  // Site survey fields
  final String? roofType;
  final double? roofAreaSqft;
  final String? roofCondition;
  final int? numFloors;
  final double? buildingHeightM;
  final String? mountingType;
  final double? azimuthDeg;
  final double? tiltDeg;
  final double? recommendedCapacityKw;
  final int? recommendedPanelCount;
  final String? recommendedInverter;
  final String? shading;
  final String? obstructionNotes;
  final double? cableRunM;
  final String? earthingType;
  final String? meterLocation;
  final String? wiringCondition;

  bool get hasSurveyData =>
      roofType != null ||
      roofAreaSqft != null ||
      roofCondition != null ||
      numFloors != null ||
      buildingHeightM != null ||
      mountingType != null ||
      azimuthDeg != null ||
      tiltDeg != null ||
      recommendedCapacityKw != null ||
      recommendedPanelCount != null ||
      recommendedInverter != null ||
      shading != null ||
      obstructionNotes != null ||
      cableRunM != null ||
      earthingType != null ||
      meterLocation != null ||
      wiringCondition != null;

  factory JobSummary.fromJson(Map<String, dynamic> json) {
    // customer join: customers!inner(name, phone) returns nested object
    final customer = json['customers'];
    String? custName;
    String? custPhone;
    if (customer is Map) {
      custName = _asNullableString(customer['name']);
      custPhone = _asNullableString(customer['phone']);
    }

    double? parseNullableDouble(dynamic v) {
      if (v == null) return null;
      return _asDouble(v);
    }

    int? parseNullableInt(dynamic v) {
      if (v == null) return null;
      if (v is int) return v;
      if (v is num) return v.toInt();
      if (v is String) return int.tryParse(v);
      return null;
    }

    return JobSummary(
      id: _asString(json['id']),
      customerId: _asString(json['customer_id']),
      customerName: custName,
      customerPhone: custPhone,
      systemType: _asNullableString(json['system_type']),
      capacityKw: parseNullableDouble(json['capacity_kw']),
      status: _asNullableString(json['status']),
      quotedPrice: parseNullableDouble(json['quoted_price']),
      totalAmount: parseNullableDouble(json['total_amount']),
      depositAmount: parseNullableDouble(json['deposit_amount']),
      balanceDue: parseNullableDouble(json['balance_due']),
      location: _asNullableString(json['location']),
      notes: _asNullableString(json['notes']),
      dateLead: _parseDate(json['date_lead']),
      dateWon: _parseDate(json['date_won']),
      dateInstall: _parseDate(json['date_install']),
      dateHandover: _parseDate(json['date_handover']),
      branchId: _asNullableString(json['branch_id']),
      programType: _asNullableString(json['program_type']),
      isLoan: json['is_loan'] == true,
      createdAt: _parseDate(json['created_at']),
      roofType: _asNullableString(json['roof_type']),
      roofAreaSqft: parseNullableDouble(json['roof_area_sqft']),
      roofCondition: _asNullableString(json['roof_condition']),
      numFloors: parseNullableInt(json['num_floors']),
      buildingHeightM: parseNullableDouble(json['building_height_m']),
      mountingType: _asNullableString(json['mounting_type']),
      azimuthDeg: parseNullableDouble(json['azimuth_deg']),
      tiltDeg: parseNullableDouble(json['tilt_deg']),
      recommendedCapacityKw: parseNullableDouble(json['recommended_capacity_kw']),
      recommendedPanelCount: parseNullableInt(json['recommended_panel_count']),
      recommendedInverter: _asNullableString(json['recommended_inverter']),
      shading: _asNullableString(json['shading']),
      obstructionNotes: _asNullableString(json['obstruction_notes']),
      cableRunM: parseNullableDouble(json['cable_run_m']),
      earthingType: _asNullableString(json['earthing_type']),
      meterLocation: _asNullableString(json['meter_location']),
      wiringCondition: _asNullableString(json['wiring_condition']),
    );
  }
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

class Customer {
  const Customer({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    required this.address,
    required this.discom,
    required this.consumerNo,
    required this.phase,
    required this.sanctionedLoadKw,
    required this.notes,
  });

  final String id;
  final String? name;
  final String? phone;
  final String? email;
  final String? address;
  final String? discom;
  final String? consumerNo;
  final String? phase;
  final double? sanctionedLoadKw;
  final String? notes;

  factory Customer.fromJson(Map<String, dynamic> json) {
    final rawLoad = json['sanctioned_load_kw'];
    return Customer(
      id: _asString(json['id']),
      name: _asNullableString(json['name']),
      phone: _asNullableString(json['phone']),
      email: _asNullableString(json['email']),
      address: _asNullableString(json['address']),
      discom: _asNullableString(json['discom']),
      consumerNo: _asNullableString(json['consumer_no']),
      phase: _asNullableString(json['phase']),
      sanctionedLoadKw: rawLoad != null ? _asDouble(rawLoad) : null,
      notes: _asNullableString(json['notes']),
    );
  }
}

// ---------------------------------------------------------------------------
// Task Item
// ---------------------------------------------------------------------------

class TaskItem {
  const TaskItem({
    required this.id,
    required this.jobId,
    required this.title,
    required this.assignedTo,
    required this.dueDate,
    required this.status,
    required this.priority,
    required this.notes,
  });

  final String id;
  final String jobId;
  final String? title;
  final String? assignedTo;
  final DateTime? dueDate;
  final String status; // Open, InProgress, Blocked, Done
  final String priority; // Low, Medium, High, Urgent

  final String? notes;

  factory TaskItem.fromJson(Map<String, dynamic> json) {
    return TaskItem(
      id: _asString(json['id']),
      jobId: _asString(json['job_id']),
      title: _asNullableString(json['title']),
      assignedTo: _asNullableString(json['assigned_to']),
      dueDate: _parseDate(json['due_date']),
      status: _asString(json['status']),
      priority: _asString(json['priority']),
      notes: _asNullableString(json['notes']),
    );
  }

  bool get isDone => status == 'Done';

  bool get isOverdue {
    if (dueDate == null || isDone) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return dueDate!.isBefore(today);
  }
}
