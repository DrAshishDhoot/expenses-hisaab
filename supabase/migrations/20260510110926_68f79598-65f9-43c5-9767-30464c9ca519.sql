
-- Profiles
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX categories_user_idx ON public.categories(user_id);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat own all" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER cat_touch BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Subcategories
CREATE TABLE public.subcategories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX subcat_user_idx ON public.subcategories(user_id);
CREATE INDEX subcat_cat_idx ON public.subcategories(category_id);
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subcat own all" ON public.subcategories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER subcat_touch BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL,
  category_id UUID,
  subcategory_id UUID,
  description TEXT,
  spent_on DATE NOT NULL,
  device_id TEXT,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX exp_user_date_idx ON public.expenses(user_id, spent_on DESC);
CREATE INDEX exp_user_updated_idx ON public.expenses(user_id, updated_at DESC);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exp own all" ON public.expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER exp_touch BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto profile + seed default categories on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  food_id UUID := gen_random_uuid();
  trans_id UUID := gen_random_uuid();
  util_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.profiles(user_id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.categories(id,user_id,name) VALUES
    (food_id, NEW.id, 'Food'),
    (trans_id, NEW.id, 'Transport'),
    (util_id, NEW.id, 'Utilities');
  INSERT INTO public.subcategories(id,user_id,category_id,name) VALUES
    (gen_random_uuid(), NEW.id, food_id, 'Groceries'),
    (gen_random_uuid(), NEW.id, food_id, 'Dining Out'),
    (gen_random_uuid(), NEW.id, food_id, 'Snacks'),
    (gen_random_uuid(), NEW.id, trans_id, 'Fuel'),
    (gen_random_uuid(), NEW.id, trans_id, 'Taxi'),
    (gen_random_uuid(), NEW.id, trans_id, 'Metro'),
    (gen_random_uuid(), NEW.id, util_id, 'Electricity'),
    (gen_random_uuid(), NEW.id, util_id, 'Internet'),
    (gen_random_uuid(), NEW.id, util_id, 'Water');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
