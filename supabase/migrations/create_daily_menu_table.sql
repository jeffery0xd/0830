-- Create daily menu table
CREATE TABLE IF NOT EXISTS app_e87b41cfe355428b8146f8bae8184e10_daily_menu (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  menu_type VARCHAR(20) NOT NULL CHECK (menu_type IN ('breakfast', 'lunch', 'dinner')),
  dishes JSONB NOT NULL DEFAULT '[]',
  created_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_menu_date ON app_e87b41cfe355428b8146f8bae8184e10_daily_menu(date);
CREATE INDEX IF NOT EXISTS idx_daily_menu_type ON app_e87b41cfe355428b8146f8bae8184e10_daily_menu(menu_type);
CREATE INDEX IF NOT EXISTS idx_daily_menu_active ON app_e87b41cfe355428b8146f8bae8184e10_daily_menu(is_active);

-- Create unique constraint to prevent duplicate menu types for the same date
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_menu_date_type ON app_e87b41cfe355428b8146f8bae8184e10_daily_menu(date, menu_type) WHERE is_active = true;

-- Enable RLS
ALTER TABLE app_e87b41cfe355428b8146f8bae8184e10_daily_menu ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Daily menu is viewable by everyone" 
  ON app_e87b41cfe355428b8146f8bae8184e10_daily_menu FOR SELECT 
  USING (true);

CREATE POLICY "Daily menu is insertable by authenticated users" 
  ON app_e87b41cfe355428b8146f8bae8184e10_daily_menu FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Daily menu is updatable by authenticated users" 
  ON app_e87b41cfe355428b8146f8bae8184e10_daily_menu FOR UPDATE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Daily menu is deletable by authenticated users" 
  ON app_e87b41cfe355428b8146f8bae8184e10_daily_menu FOR DELETE 
  USING (auth.role() = 'authenticated');

-- Insert sample data
INSERT INTO app_e87b41cfe355428b8146f8bae8184e10_daily_menu (date, menu_type, dishes, created_by) VALUES
  (CURRENT_DATE, 'breakfast', '[{"name": "豆浆油条", "price": 12, "description": "经典早餐组合"}, {"name": "小笼包", "price": 15, "description": "鲜肉小笼包8个"}]', 'admin'),
  (CURRENT_DATE, 'lunch', '[{"name": "宫保鸡丁", "price": 28, "description": "经典川菜"}, {"name": "麻婆豆腐", "price": 18, "description": "下饭神器"}, {"name": "米饭", "price": 3, "description": "优质大米"}]', 'admin'),
  (CURRENT_DATE, 'dinner', '[{"name": "红烧肉", "price": 35, "description": "肥而不腻"}, {"name": "清炒时蔬", "price": 16, "description": "时令蔬菜"}, {"name": "紫菜蛋花汤", "price": 8, "description": "清淡汤品"}]', 'admin');
