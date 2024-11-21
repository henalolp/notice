import {
    query,
    update,
    StableBTreeMap,
    Opt as AzleOpt,
    Vec as AzleVec,
    ic: Ic,
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
    updatedAt: Opt<nat64>;
    isActive: boolean;
}

// Notice Implementation with validation
class NoticeImpl implements Notice {
    constructor(
        public id: string,
        public title: string,
        public description: string,
        public createdAt: nat64,
        public updatedAt: Opt<nat64>,
        public isActive: boolean
    ) {
        this.validate();
    }

    private validate(): void {
        if (!this.id || this.id.trim().length === 0) {
            throw new Error('ID cannot be empty');
        }
        if (!this.title || this.title.trim().length === 0) {
            throw new Error('Title cannot be empty');
        }
        if (!this.description || this.description.trim().length === 0) {
            throw new Error('Description cannot be empty');
        }
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

// Serialization helper functions with error handling
const NoticeImplSerialization = {
    toBytes(notice: NoticeImpl): Uint8Array {
        try {
            const data = {
                id: notice.id,
                title: notice.title,
                description: notice.description,
                createdAt: notice.createdAt.toString(),
                updatedAt: notice.updatedAt ? notice.updatedAt.toString() : null,
                isActive: notice.isActive,
            };
            return new TextEncoder().encode(JSON.stringify(data));
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Serialization failed: ${error.message}`);
            } else {
                throw new Error('Serialization failed: Unknown error');
            }
        }
    },    fromBytes(bytes: Uint8Array): NoticeImpl {
        try {
            const data = JSON.parse(new TextDecoder().decode(bytes));
            return new NoticeImpl(
                data.id,
                data.title,
                data.description,
                BigInt(data.createdAt),
                data.updatedAt ? BigInt(data.updatedAt) : null,
                data.isActive
            );
        } catch (error) {
            throw new Error(`Deserialization failed: ${error.message}`);
        }
    }
};


// Storage Map with Serialized Values
const noticesStorage = StableBTreeMap<string, NoticeImpl>(0, {
    toBytes: NoticeImplSerialization.toBytes,
    fromBytes: NoticeImplSerialization.fromBytes
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
        return Result.Err({ InvalidInput: error.message });
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
    title: Opt<string>,
    description: Opt<string>,
    isActive: Opt<boolean>
): Result<string, NoticeError> {
    try {
        const existingNotice = noticesStorage.get(id);
        if (!existingNotice) {
            return Result.Err({ NotFound: `Notice with ID ${id} not found` });
        }

        const updatedNotice = new NoticeImpl(
            existingNotice.id,
            title?.trim() ?? existingNotice.title,
            description?.trim() ?? existingNotice.description,
            existingNotice.createdAt,
            ic.time(),
            isActive ?? existingNotice.isActive
        );

        noticesStorage.insert(id, updatedNotice);
        return Result.Ok(`Notice with ID ${id} updated successfully.`);
    } catch (error) {
        return Result.Err({ InvalidInput: error.message });
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
export function getAllNotices(): Vec<Notice> {
    return noticesStorage.values().map((notice) => ({
        id: notice.id,
        title: notice.title,
        description: notice.description,
        createdAt: notice.createdAt,
        updatedAt: notice.updatedAt,
        isActive: notice.isActive,
    }));
}
