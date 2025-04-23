/*
 * Helper Functions
 * This file contains utility functions used throughout the application.
 */

/**
 * Function: truncate_content
 * Description: Truncates text content to a specified maximum length, adding ellipsis if needed.
 * Parameters:
 *   - input_content: The text content to truncate
 *   - max_length: Maximum length of the output text (optional, defaults to 80)
 * Returns: Truncated text with ellipsis appended if truncation occurred
 * Usage: Used for generating preview text throughout the application
 */
create or replace function truncate_content(
    input_content text,
    max_length int default null
) returns text as $$
declare
    -- Define a constant for the default max length
    default_max_length constant int := 80;
begin
    -- Use the provided max_length or the default if not provided
    if max_length is null then
        max_length := default_max_length;
    end if;

    return case
        when length(input_content) > max_length then left(input_content, max_length - 3) || '...'
        else input_content
    end;
end;
$$ language plpgsql;

comment on function truncate_content(text, int) is
'Utility function to truncate text content to a specified length with ellipsis, used for preview text generation.';
