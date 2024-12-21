import {
    query,
    update,
    StableBTreeMap,
    Opt as AzleOpt,
    Vec as AzleVec,
    ic,
    Result,
} from 'azle';
import { nat64 } from 'azle';

// Error types
type NoticeError = { NotFound: string } | { InvalidInput: string };

// Define Notice Interface
interface Notice {
    id: string;
    title: string;
    description: string;
    createdAt: nat64;
    updatedAt: AzleOpt<nat64>;
    isActive: boolean;
}

// Notice Implementation with validation
class NoticeImpl implements Notice {
    private static readonly MAX_TITLE_LENGTH = 200;
    private static readonly MAX_DESCRIPTION_LENGTH = 1000;
    private static readonly MAX_ID_LENGTH = 100;

    constructor(
        public id: string,
        public title: string,
        public description: string,
        public createdAt: nat64,
        public updatedAt: AzleOpt<nat64>,
        public isActive: boolean
    ) {
        this.validate();
    }

    private validate(): void {
        validateNoticeInput(this.id, this.title, this.description);
    }

    static create(
        id: string,
        title: string,
        description: string,
        isActive: boolean = true
    ): NoticeImpl {
        return new NoticeImpl(
            id.trim(),
            title.trim(),
            description.trim(),
            ic.time(),
            null,
            isActive
        );
    }
}

// Utility function for centralized validation
function validateNoticeInput(id: string, title: string, description: string): void {
    if (!id || id.trim().length === 0) throw new Error('ID cannot be empty');
    if (id.length > NoticeImpl.MAX_ID_LENGTH) throw new Error(`ID cannot exceed ${NoticeImpl.MAX_ID_LENGTH} characters`);
    if (!/^[a-zA-Z0-9-_]+$/.test(id)) throw new Error('ID can only contain alphanumeric characters, hyphens, and underscores');
    if (!title || title.trim().length === 0) throw new Error('Title cannot be empty');
    if (title.length > NoticeImpl.MAX_TITLE_LENGTH) throw new Error(`Title cannot exceed ${NoticeImpl.MAX_TITLE_LENGTH} characters`);
    if (!description || description.trim().length === 0) throw new Error('Description cannot be empty');
    if (description.length > NoticeImpl.MAX_DESCRIPTION_LENGTH) throw new Error(`Description cannot exceed ${NoticeImpl.MAX_DESCRIPTION_LENGTH} characters`);
}

// Serialization helper functions
const NoticeImplSerialization = {
    toBytes(notice: NoticeImpl): Uint8Array {
        const data = {
            id: notice.id,
            title: notice.title,
            description: notice.description,
            createdAt: notice.createdAt.toString(),
            updatedAt: notice.updatedAt ? notice.updatedAt.toString() : null,
            isActive: notice.isActive,
        };
        return new TextEncoder().encode(JSON.stringify(data));
    },
    fromBytes(bytes: Uint8Array): NoticeImpl {
        const data = JSON.parse(new TextDecoder().decode(bytes));
        return new NoticeImpl(
            data.id,
            data.title,
            data.description,
            BigInt(data.createdAt),
            data.updatedAt ? BigInt(data.updatedAt) : null,
            data.isActive ?? true
        );
    },
};

// Storage Map
const noticesStorage = StableBTreeMap<string, NoticeImpl>(0, {
    toBytes: NoticeImplSerialization.toBytes,
    fromBytes: NoticeImplSerialization.fromBytes,
});

// Create Notice
@update
export function createNotice(
    id: string,
    title: string,
    description: string,
    isActive: boolean = true
): Result<string, NoticeError> {
    try {
        if (noticesStorage.containsKey(id)) {
            return Result.Err({ InvalidInput: `Notice with ID ${id} already exists` });
        }

        const notice = NoticeImpl.create(id, title, description, isActive);
        noticesStorage.insert(notice.id, notice);
        return Result.Ok(`Notice with ID ${id} created successfully.`);
    } catch (error) {
        if (error instanceof Error) {
            return Result.Err({ InvalidInput: error.message });
        }
        return Result.Err({ InvalidInput: "An unknown error occurred" });
    }
}

// Get Notice by ID
@query
export function getNoticeById(id: string): Result<Notice, NoticeError> {
    const notice = noticesStorage.get(id);
    if (!notice) {
        return Result.Err({ NotFound: `Notice with ID ${id} not found` });
    }

    return Result.Ok({
        id: notice.id,
        title: notice.title,
        description: notice.description,
        createdAt: notice.createdAt,
        updatedAt: notice.updatedAt,
        isActive: notice.isActive,
    });
}

// Update Notice
@update
export function updateNotice(
    id: string,
    title: AzleOpt<string>,
    description: AzleOpt<string>,
    isActive: AzleOpt<boolean>
): Result<string, NoticeError> {
    try {
        const existingNotice = noticesStorage.get(id);
        if (!existingNotice) {
            return Result.Err({ NotFound: `Notice with ID ${id} not found` });
        }

        if (title !== null || description !== null) {
            validateNoticeInput(id, title ?? existingNotice.title, description ?? existingNotice.description);
        }

        const updatedNotice = new NoticeImpl(
            id,
            title?.trim() ?? existingNotice.title,
            description?.trim() ?? existingNotice.description,
            existingNotice.createdAt,
            ic.time(),
            isActive ?? existingNotice.isActive
        );

        noticesStorage.insert(id, updatedNotice);
        return Result.Ok(`Notice with ID ${id} updated successfully.`);
    } catch (error) {
        if (error instanceof Error) {
            return Result.Err({ InvalidInput: error.message });
        }
        return Result.Err({ InvalidInput: "An unknown error occurred" });
    }
}

// Delete Notice
@update
export function deleteNotice(id: string): Result<string, NoticeError> {
    if (!noticesStorage.containsKey(id)) {
        return Result.Err({ NotFound: `Notice with ID ${id} not found` });
    }

    noticesStorage.remove(id);
    return Result.Ok(`Notice with ID ${id} deleted successfully.`);
}

// Get All Notices
@query
export function getAllNotices(): AzleVec<Notice> {
    return noticesStorage.values().map((notice) => ({
        id: notice.id,
        title: notice.title,
        description: notice.description,
        createdAt: notice.createdAt,
        updatedAt: notice.updatedAt,
        isActive: notice.isActive,
    }));
}

// Get Notices with Pagination
@query
export function getNotices(limit: number = 10, offset: number = 0): Result<{ notices: AzleVec<Notice>; total: number }, NoticeError> {
    try {
        if (limit < 0 || offset < 0) {
            return Result.Err({ InvalidInput: "Limit and offset must be non-negative" });
        }

        const keys = Array.from(noticesStorage.keys());
        const total = keys.length;
        const paginatedKeys = keys.slice(offset, offset + limit);

        const paginatedNotices = paginatedKeys.map((key) => noticesStorage.get(key)!);

        return Result.Ok({
            notices: paginatedNotices.map((notice) => ({
                id: notice.id,
                title: notice.title,
                description: notice.description,
                createdAt: notice.createdAt,
                updatedAt: notice.updatedAt,
                isActive: notice.isActive,
            })),
            total,
        });
    } catch (error) {
        if (error instanceof Error) {
            return Result.Err({ InvalidInput: error.message });
        }
        return Result.Err({ InvalidInput: "An unknown error occurred" });
    }
}

// Search Notices
@query
export function searchNotices(query: string): Result<AzleVec<Notice>, NoticeError> {
    try {
        if (!query || query.trim().length === 0) {
            return Result.Err({ InvalidInput: "Search query cannot be empty" });
        }

        const searchTerm = query.toLowerCase().trim();
        const notices = noticesStorage.values().filter(
            (notice) =>
                notice.title.toLowerCase().includes(searchTerm) ||
                notice.description.toLowerCase().includes(searchTerm)
        );

        return Result.Ok(
            notices.map((notice) => ({
                id: notice.id,
                title: notice.title,
                description: notice.description,
                createdAt: notice.createdAt,
                updatedAt: notice.updatedAt,
                isActive: notice.isActive,
            }))
        );
    } catch (error) {
        if (error instanceof Error) {
            return Result.Err({ InvalidInput: error.message });
        }
        return Result.Err({ InvalidInput: "An unknown error occurred" });
    }
}
