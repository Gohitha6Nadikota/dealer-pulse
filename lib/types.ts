export type Branch = {
  id: string;
  name: string;
  city: string;
};

export type SalesRep = {
  id: string;
  name: string;
  branch_id: string;
  role: string;
  joined: string;
};

export type Lead = {
  id: string;
  customer_name: string;
  source: string;
  model_interested: string;
  status: string;
  assigned_to: string;
  branch_id: string;
  created_at: string;
  last_activity_at: string;
  expected_close_date: string;
  deal_value: number;
  lost_reason?: string | null;
  status_history: {
    status: string;
    timestamp: string;
    note?: string;
  }[];
};

export type Target = {
  branch_id: string;
  month: string;
  target_units: number;
  target_revenue: number;
};

export type Delivery = {
  lead_id: string;
  order_date: string;
  delivery_date: string;
  days_to_deliver: number;
  delay_reason: string | null;
};

export type DealershipData = {
  metadata: {
    generated_at: string;
    description: string;
    date_range: string;
    notes: string;
  };
  branches: Branch[];
  sales_reps: SalesRep[];
  leads: Lead[];
  targets: Target[];
  deliveries: Delivery[];
};