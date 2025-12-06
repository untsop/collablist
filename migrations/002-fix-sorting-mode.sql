-- Migration to update sorting_mode values from old to new format
-- Change 'position' to 'manual' and 'votes' to 'vote'

UPDATE lists SET sorting_mode = 'manual' WHERE sorting_mode = 'position';
UPDATE lists SET sorting_mode = 'vote' WHERE sorting_mode = 'votes';
