// Type definitions for Notion converter

// Basic property filter types
export type TextFilter = {
    property: string;
    rich_text: {
        contains?: string;
        equals?: string;
        does_not_equal?: string;
        starts_with?: string;
        ends_with?: string;
        is_empty?: boolean;
        is_not_empty?: boolean;
    };
};

export type SelectFilter = {
    property: string;
    select: {
        equals?: string;
        does_not_equal?: string;
        is_empty?: boolean;
        is_not_empty?: boolean;
    };
};

export type MultiSelectFilter = {
    property: string;
    multi_select: {
        contains?: string;
        does_not_contain?: string;
        is_empty?: boolean;
        is_not_empty?: boolean;
    };
};

export type DateFilter = {
    property: string;
    date: {
        equals?: string;
        before?: string;
        after?: string;
        on_or_before?: string;
        on_or_after?: string;
        is_empty?: boolean;
        is_not_empty?: boolean;
    };
};

export type CheckboxFilter = {
    property: string;
    checkbox: {
        equals?: boolean;
        does_not_equal?: boolean;
    };
};

// Compound filter types
export type AndFilter = {
    and: FilterType[];
};

export type OrFilter = {
    or: FilterType[];
};

// Union type for all possible filter types
export type FilterType =
    | TextFilter
    | SelectFilter
    | MultiSelectFilter
    | DateFilter
    | CheckboxFilter
    | AndFilter
    | OrFilter;

// Type for filter config object
export type FilterConfig = Record<string, FilterType>;

// Types for subpage handling
export type SubpageInfo = {
    id: string;
    title: string;
    type: 'page' | 'database';
    parent_id: string;
    url: string;
};

export type PageMetadata = {
    title: string;
    created_at?: string;
    last_edited_at?: string;
    source?: string;
    parent_page?: string;
    parent_database?: string;
    [key: string]: any; // Allow for custom metadata fields
};

export type ConversionOptions = {
    max_depth: number;
    current_depth: number;
    include_subpages: boolean;
    parent_info?: {
        id: string;
        title: string;
        type: 'page' | 'database';
    };
}; 