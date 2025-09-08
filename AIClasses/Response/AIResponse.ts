/**
 * Interfaces for requested custom API responses.
 */

interface AIResponse {
    function_calls: FunctionCall[];
    
    // function_name: string | null;
    // function_object: object | null;
    // user_response: string;
}

interface CreateFileRequest {
    file_path: string;
    file_content: string;
}