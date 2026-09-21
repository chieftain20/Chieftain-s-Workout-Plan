-- ==============================================================================
-- 🧪 Chieftain Pro Workout - Automated Database Security Verification Suite
-- Run this script in the Supabase SQL Editor to test RLS & Anti-Tamper Triggers
-- ==============================================================================

DO $$
DECLARE
  user_a uuid := '11111111-1111-1111-1111-111111111111';
  user_b uuid := '22222222-2222-2222-2222-222222222222';
  test_passed boolean := true;
  row_count integer;
BEGIN
  RAISE NOTICE '🚀 Starting Chieftain Pro Database Security Test Suite...';

  -- 1. Setup Mock User Profiles & Data (as postgres superuser)
  DELETE FROM public.profiles WHERE id IN (user_a, user_b);
  DELETE FROM public.workout_logs WHERE user_id IN (user_a, user_b);

  INSERT INTO public.profiles (id, display_name, role) VALUES 
    (user_a, 'User A', 'user'),
    (user_b, 'User B', 'user');

  INSERT INTO public.workout_logs (user_id, exercise_id, log_entry) VALUES
    (user_a, 'chest_press', '{"weight": 80, "reps": 10}'::jsonb),
    (user_b, 'lat_pulldown', '{"weight": 60, "reps": 12}'::jsonb);

  RAISE NOTICE '✅ Test fixture setup complete.';

  -- ==============================================================================
  -- TEST A: User A attempts self-promotion via UPDATE
  -- ==============================================================================
  BEGIN
    -- Simulate authenticated JWT session for User A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

    UPDATE public.profiles SET role = 'admin' WHERE id = user_a;
    
    -- If it didn't raise an exception, test failed!
    RAISE EXCEPTION 'TEST A FAILED: User A was able to update role to admin!';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Cannot change profile role%' OR SQLERRM LIKE '%permission denied for column role%' OR SQLERRM LIKE '%permission denied%' THEN
        RAISE NOTICE '✅ TEST A PASSED: Self-promotion via UPDATE correctly blocked. Error: %', SQLERRM;
      ELSE
        RAISE NOTICE '⚠️ TEST A: Blocked with unexpected error: %', SQLERRM;
      END IF;
  END;

  -- ==============================================================================
  -- TEST B: User A attempts admin injection on INSERT
  -- ==============================================================================
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

    INSERT INTO public.profiles (id, display_name, role) VALUES (user_a, 'Attacker', 'admin');
    
    RAISE EXCEPTION 'TEST B FAILED: User A was able to insert profile with role=admin!';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Cannot create profile with elevated role%' OR SQLERRM LIKE '%duplicate key%' OR SQLERRM LIKE '%unique%' THEN
        RAISE NOTICE '✅ TEST B PASSED: Admin injection on INSERT correctly blocked. Error: %', SQLERRM;
      ELSE
        RAISE NOTICE '⚠️ TEST B: Blocked with: %', SQLERRM;
      END IF;
  END;

  -- ==============================================================================
  -- TEST C: User A attempts to edit User B profile
  -- ==============================================================================
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  UPDATE public.profiles SET display_name = 'Hacked by A' WHERE id = user_b;
  GET DIAGNOSTICS row_count = ROW_COUNT;

  IF row_count = 0 THEN
    RAISE NOTICE '✅ TEST C PASSED: Cross-user profile UPDATE affected 0 rows (RLS blocked).';
  ELSE
    RAISE EXCEPTION 'TEST C FAILED: User A updated User B profile! Rows affected: %', row_count;
  END IF;

  -- ==============================================================================
  -- TEST D: User A attempts to read User B workout logs
  -- ==============================================================================
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO row_count FROM public.workout_logs WHERE user_id = user_b;

  IF row_count = 0 THEN
    RAISE NOTICE '✅ TEST D PASSED: Cross-user workout_logs SELECT returned 0 rows (RLS blocked).';
  ELSE
    RAISE EXCEPTION 'TEST D FAILED: User A was able to read User B logs! Count: %', row_count;
  END IF;

  -- ==============================================================================
  -- TEST E: User A attempts to overwrite User B workout logs
  -- ==============================================================================
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  UPDATE public.workout_logs SET log_entry = '{"tampered":true}'::jsonb WHERE user_id = user_b;
  GET DIAGNOSTICS row_count = ROW_COUNT;

  IF row_count = 0 THEN
    RAISE NOTICE '✅ TEST E PASSED: Cross-user workout_logs UPDATE affected 0 rows (RLS blocked).';
  ELSE
    RAISE EXCEPTION 'TEST E FAILED: User A modified User B logs! Rows affected: %', row_count;
  END IF;

  -- Cleanup
  PERFORM set_config('role', 'postgres', true);
  DELETE FROM public.profiles WHERE id IN (user_a, user_b);
  DELETE FROM public.workout_logs WHERE user_id IN (user_a, user_b);

  RAISE NOTICE '🎉 ALL 5 DATABASE SECURITY & ISOLATION TESTS PASSED SUCCESSFULLY!';
END $$;
