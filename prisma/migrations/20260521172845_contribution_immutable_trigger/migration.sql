-- ============================================================================
-- DB TRIGGER: Защита иммутабельных полей взносов на уровне PostgreSQL
-- ============================================================================
-- Этот триггер ЗАПРЕЩАЕТ обновление полей locked_at_timestamp и
-- locked_exchange_rate в таблице contributions после их установки.
-- Это дополнительный (2-й) уровень защиты помимо сервисного слоя.
-- ============================================================================

-- Функция триггера
CREATE OR REPLACE FUNCTION guard_contribution_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Запрещаем изменение locked_at_timestamp, если оно уже было установлено
  IF OLD.locked_at_timestamp IS NOT NULL AND
     (NEW.locked_at_timestamp IS DISTINCT FROM OLD.locked_at_timestamp OR
      NEW.locked_exchange_rate IS DISTINCT FROM OLD.locked_exchange_rate) THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD_VIOLATION: Cannot update locked_at_timestamp or locked_exchange_rate on contribution #% — these fields are immutable after creation', NEW.id
      USING HINT = 'Financial audit fields (locked_at_timestamp, locked_exchange_rate) cannot be modified after they have been set.';
  END IF;

  -- Запрещаем изменение amount, exchange_rate_used, currency_used, original_amount
  -- для взносов со статусом 'completed' или 'refunded'
  IF OLD.status IN ('completed', 'refunded') AND NEW.status IN ('completed', 'refunded') THEN
    IF OLD.amount IS DISTINCT FROM NEW.amount OR
       OLD.exchange_rate_used IS DISTINCT FROM NEW.exchange_rate_used OR
       OLD.currency_used IS DISTINCT FROM NEW.currency_used OR
       OLD.original_amount IS DISTINCT FROM NEW.original_amount OR
       OLD.guest_id IS DISTINCT FROM NEW.guest_id OR
       OLD.gift_id IS DISTINCT FROM NEW.gift_id THEN
      RAISE EXCEPTION 'IMMUTABLE_FIELD_VIOLATION: Cannot modify financial fields on contribution #% — finalized contributions are immutable', NEW.id
        USING HINT = 'Once a contribution reaches completed or refunded status, its financial fields (amount, exchange_rate_used, currency_used, original_amount, guest_id, gift_id) cannot be changed.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггер к таблице contributions
DROP TRIGGER IF EXISTS trg_guard_contribution_immutable ON contributions;
CREATE TRIGGER trg_guard_contribution_immutable
  BEFORE UPDATE ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION guard_contribution_immutable_fields();
