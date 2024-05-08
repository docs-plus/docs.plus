/*
Helper functions
*/

CREATE OR REPLACE FUNCTION truncate_content(input_content TEXT, max_length INT DEFAULT NULL) RETURNS TEXT AS $$
DECLARE
    -- Define a constant for the default max length
    DEFAULT_MAX_LENGTH CONSTANT INT := 80;
BEGIN
    -- Use the provided max_length or the default if not provided
    IF max_length IS NULL THEN
        max_length := DEFAULT_MAX_LENGTH;
    END IF;

    RETURN CASE
        WHEN LENGTH(input_content) > max_length THEN LEFT(input_content, max_length - 3) || '...'
        ELSE input_content
    END;
END;
$$ LANGUAGE plpgsql;
