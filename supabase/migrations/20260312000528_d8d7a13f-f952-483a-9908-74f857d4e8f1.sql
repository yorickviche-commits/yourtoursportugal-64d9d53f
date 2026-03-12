
-- 1. AGENT REGISTRY
CREATE TABLE IF NOT EXISTS ai_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        TEXT UNIQUE NOT NULL,
  display_name    TEXT NOT NULL,
  role_description TEXT,
  desk_position   JSONB,
  character_color TEXT DEFAULT '#4CAF50',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. AGENT STATUS
CREATE TABLE IF NOT EXISTS agent_status (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        TEXT UNIQUE NOT NULL REFERENCES ai_agents(agent_id),
  status          TEXT NOT NULL DEFAULT 'idle',
  current_task    TEXT,
  current_entity  TEXT,
  waiting_for     TEXT,
  started_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 3. AGENT ACTIVITY LOG
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        TEXT NOT NULL REFERENCES ai_agents(agent_id),
  event_type      TEXT NOT NULL,
  event_summary   TEXT NOT NULL,
  event_detail    JSONB,
  related_entity  TEXT,
  requires_action BOOLEAN DEFAULT false,
  actioned_by     UUID,
  actioned_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. CEO APPROVAL QUEUE
CREATE TABLE IF NOT EXISTS ceo_approval_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        TEXT NOT NULL REFERENCES ai_agents(agent_id),
  approval_type   TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  amount_eur      NUMERIC(10,2),
  lead_id         UUID,
  trip_id         UUID,
  payload         JSONB,
  status          TEXT DEFAULT 'pending',
  decided_by      UUID,
  decided_at      TIMESTAMPTZ,
  decision_note   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_agent_status_agent_id ON agent_status(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_agent_id ON agent_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON agent_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_requires_action ON agent_activity_log(requires_action) WHERE requires_action = true;
CREATE INDEX IF NOT EXISTS idx_ceo_queue_status ON ceo_approval_queue(status) WHERE status = 'pending';

-- ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE agent_status;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE ceo_approval_queue;

-- RLS
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceo_approval_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_agents" ON ai_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_status" ON agent_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_log" ON agent_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_queue" ON ceo_approval_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_write_agents" ON ai_agents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_status" ON agent_status FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_log" ON agent_activity_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_queue" ON ceo_approval_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_update_queue" ON ceo_approval_queue
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (status IN ('approved', 'rejected'));

-- SEED 13 AGENTS
INSERT INTO ai_agents (agent_id, display_name, role_description, desk_position, character_color) VALUES
  ('lead_qualifier',      'Lead Qualifier',          'Qualifies inbound leads from all sources',                       '{"x":1,"y":1}', '#4CAF50'),
  ('proposal_builder',    'Proposal Builder',        'Builds bespoke trip proposals',                                  '{"x":3,"y":1}', '#2196F3'),
  ('followup_writer',     'Follow-Up Writer',        'Sends timely follow-ups to warm leads',                          '{"x":5,"y":1}', '#FF9800'),
  ('b2b_partner_manager', 'B2B Partner Manager',     'Manages trade and agency relationships',                         '{"x":7,"y":1}', '#9C27B0'),
  ('itinerary_architect', 'Itinerary Architect',     'Designs detailed day-by-day itineraries',                        '{"x":1,"y":3}', '#00BCD4'),
  ('pricing_margin',      'Pricing & Margin',        'Enforces 20% floor, flags CEO approval over EUR 8,000',          '{"x":3,"y":3}', '#F44336'),
  ('operations_coordinator','Operations Coordinator','Coordinates all operational logistics',                           '{"x":5,"y":3}', '#795548'),
  ('supplier_communication','Supplier Communication','Handles supplier confirmations and briefs',                       '{"x":7,"y":3}', '#607D8B'),
  ('crm_manager',         'CRM Manager',             'Keeps NetHunt pipeline stages clean and accurate',               '{"x":1,"y":5}', '#E91E63'),
  ('payment_monitor',     'Payment Monitor',         'Tracks WeTravel and Stripe payment status',                      '{"x":3,"y":5}', '#3F51B5'),
  ('customer_support',    'Customer Support',        'In-trip support and issue resolution',                           '{"x":5,"y":5}', '#009688'),
  ('review_reputation',   'Review & Reputation',     'Manages post-trip reviews and NPS',                              '{"x":7,"y":5}', '#FF5722'),
  ('ceo_advisor',         'CEO Strategic Advisor',   'Strategic escalations and CEO briefings',                        '{"x":4,"y":7}', '#FFD700')
ON CONFLICT (agent_id) DO NOTHING;

-- SEED INITIAL STATUS ROWS
INSERT INTO agent_status (agent_id, status, current_task)
SELECT agent_id, 'idle', 'Standing by'
FROM ai_agents
ON CONFLICT (agent_id) DO NOTHING;
