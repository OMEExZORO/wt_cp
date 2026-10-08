ALTER TABLE checklist_items ADD COLUMN attention_answers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE checklist_items SET attention_answers = ARRAY[attention_answer] WHERE attention_answer IS NOT NULL;

ALTER TABLE checklist_items DROP COLUMN attention_answer;
