import { Canister, query, text } from 'azle';

import { ic, nat64, StableBTreeMap, $query, $update, Result, Vec } from 'azle';

// Types
type NoticeId = string;

interface Notice {
    id: NoticeId;
    title: string;
    description: string;
    createdAt: nat64;
    updatedAt: nat64 | null;
    isActive: boolean;
}

// Storage
const noticesStorage = new StableBTreeMap<NoticeId, Notice>(0, 44, 1024);

// Create Notice
$update;
export function createNotice(title: string, description: string): Result<Notice, string> {
    try {
        const notice: Notice = {
            id: generateId(),
            title: title.trim(),
            description: description.trim(),
            createdAt: ic.time(),
            updatedAt: null,
            isActive: true
        };

        noticesStorage.insert(notice.id, notice);
        return Result.Ok(notice);
    } catch (error) {
        return Result.Err(`Failed to create notice: ${error}`);
    }
}

// Get All Notices
$query;
export function getNotices(): Result<Vec<Notice>, string> {
    try {
        return Result.Ok(noticesStorage.values());
    } catch (error) {
        return Result.Err(`Failed to get notices: ${error}`);
    }
}

// Get Single Notice
$query;
export function getNotice(id: NoticeId): Result<Notice, string> {
    try {
        const notice = noticesStorage.get(id);
        if (!notice) {
            return Result.Err(`Notice with id=${id} not found`);
        }
        return Result.Ok(notice);
    } catch (error) {
        return Result.Err(`Failed to get notice: ${error}`);
    }
}

// Update Notice
$update;
export function updateNotice(id: NoticeId, title?: string, description?: string): Result<Notice, string> {
    try {
        const existingNotice = noticesStorage.get(id);
        if (!existingNotice) {
            return Result.Err(`Notice with id=${id} not found`);
        }

        const updatedNotice: Notice = {
            ...existingNotice,
            title: title?.trim() || existingNotice.title,
            description: description?.trim() || existingNotice.description,
            updatedAt: ic.time()
        };

        noticesStorage.insert(id, updatedNotice);
        return Result.Ok(updatedNotice);
    } catch (error) {
        return Result.Err(`Failed to update notice: ${error}`);
    }
}

// Delete Notice
$update;
export function deleteNotice(id: NoticeId): Result<boolean, string> {
    try {
        const notice = noticesStorage.get(id);
        if (!notice) {
            return Result.Err(`Notice with id=${id} not found`);
        }

        const updatedNotice: Notice = {
            ...notice,
            isActive: false,
            updatedAt: ic.time()
        };

        noticesStorage.insert(id, updatedNotice);
        return Result.Ok(true);
    } catch (error) {
        return Result.Err(`Failed to delete notice: ${error}`);
    }
}

// Helper function to generate ID
function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}