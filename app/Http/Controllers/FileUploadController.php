<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FileUploadController extends Controller
{
    public function uploadAutomationFile(Request $request)
    {
        try {
            // Different max sizes for different types
            $maxSize = $request->type === 'video' ? 51200 : 10240; // 50MB for video, 10MB for others
            
            $request->validate([
                'file' => "required|file|max:{$maxSize}",
                'type' => 'required|in:image,video,document'
            ]);

            $file = $request->file('file');
            $type = $request->type;

            // Validate file type based on automation type
            if ($type === 'image') {
                $request->validate([
                    'file' => 'image|mimes:jpeg,png,jpg,gif,webp'
                ]);
            } elseif ($type === 'video') {
                $request->validate([
                    'file' => 'mimes:mp4,avi,mov,wmv,flv,webm,mkv'
                ]);
            }

            // Generate unique filename with timestamp prefix to avoid conflicts
            $originalName = $file->getClientOriginalName();
            $extension = $file->getClientOriginalExtension();
            $filename = time() . '_' . Str::random(10) . '.' . $extension;
            
            // Store file in automation folder
            $path = $file->storeAs("automation/{$type}s", $filename, 'public');
            
            return response()->json([
                'success' => true,
                'path' => $path,
                'url' => $path, // Store relative path, not full URL
                'filename' => $filename,
                'original_name' => $originalName,
                'size' => $file->getSize()
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->validator->errors()->first()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('File upload error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Ошибка при загрузке файла: ' . $e->getMessage()
            ], 500);
        }
    }

    public function deleteAutomationFile(Request $request)
    {
        $request->validate([
            'path' => 'required|string'
        ]);

        $path = $request->path;
        
        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }

        return response()->json(['success' => true]);
    }
}