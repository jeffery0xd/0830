-- 创建RPC函数来处理清零操作并同时更新账户状态
CREATE OR REPLACE FUNCTION create_reset_operation_with_status_update(
    p_account_id UUID,
    p_personnel_id UUID DEFAULT NULL,
    p_account_name TEXT DEFAULT 'Unknown Account',
    p_ad_account_id TEXT DEFAULT 'N/A',
    p_balance DECIMAL DEFAULT 0,
    p_screenshot_url TEXT DEFAULT NULL,
    p_operator_name TEXT DEFAULT 'Unknown Operator'
)
RETURNS TABLE(
    id UUID,
    account_id UUID,
    personnel_id UUID,
    account_name TEXT,
    ad_account_id TEXT,
    balance DECIMAL,
    screenshot_url TEXT,
    operator_name TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reset_record RECORD;
BEGIN
    -- 开始事务处理
    
    -- 1. 创建清零记录
    INSERT INTO app_e87b41cfe355428b8146f8bae8184e10_reset_operations (
        account_id,
        personnel_id,
        account_name,
        ad_account_id,
        balance,
        screenshot_url,
        operator_name
    ) VALUES (
        p_account_id,
        p_personnel_id,
        p_account_name,
        p_ad_account_id,
        p_balance,
        p_screenshot_url,
        p_operator_name
    ) RETURNING * INTO v_reset_record;
    
    -- 2. 更新账户状态为"Reset"
    UPDATE app_e87b41cfe355428b8146f8bae8184e10_account_management_ads 
    SET 
        status = 'Reset',
        updated_at = NOW()
    WHERE id = p_account_id;
    
    -- 3. 返回创建的清零记录
    RETURN QUERY SELECT 
        v_reset_record.id,
        v_reset_record.account_id,
        v_reset_record.personnel_id,
        v_reset_record.account_name,
        v_reset_record.ad_account_id,
        v_reset_record.balance,
        v_reset_record.screenshot_url,
        v_reset_record.operator_name,
        v_reset_record.created_at;
        
EXCEPTION
    WHEN OTHERS THEN
        -- 如果出现任何错误，事务会自动回滚
        RAISE EXCEPTION '清零操作失败: %', SQLERRM;
END;
$$;

-- 授予必要的权限
GRANT EXECUTE ON FUNCTION create_reset_operation_with_status_update TO anon, authenticated;
