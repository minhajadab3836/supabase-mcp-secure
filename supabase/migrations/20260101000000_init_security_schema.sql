-- ==============================================================================
-- Secure Supabase MCP Server Initial Schema & Stored Procedures
-- Migration: 20260101000000_init_security_schema.sql
-- ==============================================================================

-- 1. Create Immutable Audit Table
CREATE TABLE IF NOT EXISTS public.mcp_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_name TEXT NOT NULL,
    caller_role TEXT NOT NULL CHECK (caller_role IN ('read_only', 'admin')),
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    execution_time_ms INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'BLOCKED', 'ERROR')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.mcp_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_created_at 
    ON public.mcp_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_status 
    ON public.mcp_audit_logs (status);

-- 2. Domain Tables (Sample E-commerce Schema for Demonstrations)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'archived')) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3. Stored Procedure: get_customer_metrics (Read-Only Air-Gapped Query)
CREATE OR REPLACE FUNCTION public.get_customer_metrics(
    start_date DATE,
    limit_val INT DEFAULT 10
)
RETURNS TABLE (
    customer_id UUID,
    full_name TEXT,
    email TEXT,
    status TEXT,
    total_orders BIGINT,
    total_spent NUMERIC,
    last_active TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS customer_id,
        c.full_name,
        c.email,
        c.status,
        COALESCE(COUNT(o.id), 0) AS total_orders,
        COALESCE(SUM(o.amount), 0.00) AS total_spent,
        COALESCE(MAX(o.created_at), c.created_at) AS last_active
    FROM public.customers c
    LEFT JOIN public.orders o 
        ON o.customer_id = c.id 
        AND o.created_at >= start_date
    GROUP BY c.id, c.full_name, c.email, c.status
    ORDER BY total_spent DESC
    LIMIT limit_val;
END;
$$;

-- 4. Stored Procedure: update_customer_status (Audited Mutation Query)
CREATE OR REPLACE FUNCTION public.update_customer_status(
    target_customer_id UUID,
    new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_row public.customers;
BEGIN
    IF new_status NOT IN ('active', 'suspended', 'archived') THEN
        RAISE EXCEPTION 'Invalid status value: %', new_status;
    END IF;

    UPDATE public.customers
    SET status = new_status,
        updated_at = timezone('utc'::text, now())
    WHERE id = target_customer_id
    RETURNING * INTO updated_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer with ID % not found', target_customer_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'customer_id', updated_row.id,
        'status', updated_row.status,
        'updated_at', updated_row.updated_at
    );
END;
$$;

-- 5. Seed Demonstration Data (Optional)
INSERT INTO public.customers (id, email, full_name, status)
VALUES 
    ('123e4567-e89b-12d3-a456-426614174000', 'alice@example.com', 'Alice Smith', 'active'),
    ('223e4567-e89b-12d3-a456-426614174001', 'bob@example.com', 'Bob Jones', 'suspended')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.orders (customer_id, amount, created_at)
VALUES 
    ('123e4567-e89b-12d3-a456-426614174000', 149.99, NOW() - INTERVAL '5 days'),
    ('123e4567-e89b-12d3-a456-426614174000', 89.50, NOW() - INTERVAL '2 days'),
    ('223e4567-e89b-12d3-a456-426614174001', 45.00, NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;
