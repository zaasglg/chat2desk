<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaStreamController extends Controller
{
    /**
     * Stream media files with Range request support for efficient video playback
     */
    public function stream(Request $request, string $path)
    {
        $disk = 'public';
        
        if (!Storage::disk($disk)->exists($path)) {
            abort(404, 'File not found');
        }

        $fullPath = Storage::disk($disk)->path($path);
        $mimeType = Storage::disk($disk)->mimeType($path);
        $size = Storage::disk($disk)->size($path);

        // Check if it's a video file
        $isVideo = str_starts_with($mimeType, 'video/');

        // Handle Range requests for video streaming
        $start = 0;
        $end = $size - 1;
        $length = $size;
        $statusCode = 200;

        if ($request->header('Range') && $isVideo) {
            $statusCode = 206; // Partial Content

            $range = $request->header('Range');
            // Parse range header: "bytes=0-1000"
            if (preg_match('/bytes=(\d+)-(\d*)/', $range, $matches)) {
                $start = intval($matches[1]);
                if (!empty($matches[2])) {
                    $end = intval($matches[2]);
                }
            }

            // Ensure we don't exceed file size
            if ($start > $size - 1) {
                $start = 0;
            }
            if ($end >= $size) {
                $end = $size - 1;
            }

            $length = $end - $start + 1;
        }

        $headers = [
            'Content-Type' => $mimeType,
            'Content-Length' => $length,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'public, max-age=604800', // Cache for 1 week
        ];

        if ($statusCode === 206) {
            $headers['Content-Range'] = sprintf('bytes %d-%d/%d', $start, $end, $size);
        }

        $response = new StreamedResponse(function () use ($fullPath, $start, $length) {
            $handle = fopen($fullPath, 'rb');
            
            if ($start > 0) {
                fseek($handle, $start);
            }

            $remaining = $length;
            $chunkSize = 1024 * 1024; // 1MB chunks

            while ($remaining > 0 && !feof($handle)) {
                $readSize = min($chunkSize, $remaining);
                echo fread($handle, $readSize);
                $remaining -= $readSize;
                flush();
            }

            fclose($handle);
        }, $statusCode, $headers);

        return $response;
    }

    /**
     * Generate video thumbnail (first frame)
     */
    public function thumbnail(Request $request, string $path)
    {
        $disk = 'public';
        
        if (!Storage::disk($disk)->exists($path)) {
            abort(404, 'File not found');
        }

        $thumbnailPath = 'thumbnails/' . md5($path) . '.jpg';

        // Check if thumbnail already exists
        if (Storage::disk($disk)->exists($thumbnailPath)) {
            return response()->file(
                Storage::disk($disk)->path($thumbnailPath),
                ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'public, max-age=604800']
            );
        }

        // Check if FFmpeg is available
        $ffmpegPath = 'ffmpeg';
        $fullPath = Storage::disk($disk)->path($path);
        $thumbnailFullPath = Storage::disk($disk)->path($thumbnailPath);

        // Create thumbnails directory if it doesn't exist
        Storage::disk($disk)->makeDirectory('thumbnails');

        // Try to generate thumbnail using FFmpeg
        $command = sprintf(
            '%s -i %s -vframes 1 -ss 00:00:01 -f image2 %s 2>&1',
            escapeshellcmd($ffmpegPath),
            escapeshellarg($fullPath),
            escapeshellarg($thumbnailFullPath)
        );

        exec($command, $output, $returnCode);

        if ($returnCode === 0 && Storage::disk($disk)->exists($thumbnailPath)) {
            return response()->file(
                $thumbnailFullPath,
                ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'public, max-age=604800']
            );
        }

        // Return a placeholder if thumbnail generation failed
        abort(404, 'Thumbnail not available');
    }
}
