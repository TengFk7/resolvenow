# Entity-Relationship (ER) Diagram - ResolvNow

เอกสารนี้แสดงโครงสร้างและความสัมพันธ์ของฐานข้อมูล (MongoDB) ภายในระบบ ResolvNow (ครอบคลุมทั้ง 7 Collections)

```mermaid
erDiagram
    USER ||--o{ TICKET : "creates (Citizen)"
    USER ||--o{ TICKET : "assigned to (Technician)"
    USER ||--o{ COMMENT : "writes"
    USER ||--o{ HELP_REQUEST : "requests / accepts"
    USER ||--o{ DIRECT_MESSAGE : "sends (senderId)"
    USER ||--o{ DIRECT_MESSAGE : "owns thread (citizenId)"
    CATEGORY ||--o{ TICKET : "categorizes"
    CATEGORY }|--o{ USER : "has technicians (technicianIds)"
    TICKET ||--o{ COMMENT : "has"
    TICKET ||--o{ HELP_REQUEST : "generates"
    TICKET }o--o{ USER : "followed by / upvoted by"

    USER {
        ObjectId _id PK
        String firstName
        String lastName
        String email "UNIQUE"
        String password
        String role "citizen, technician, admin"
        String specialty "For technicians (Ref Category)"
        String lineUserId "Nullable"
        String lineDisplayName "Nullable"
        String avatar
        Boolean createdViaLine
        Date createdAt
        Date updatedAt
    }

    TICKET {
        ObjectId _id PK
        String ticketId "e.g., TKT-00001 (UNIQUE)"
        ObjectId citizenId FK "Ref User"
        String citizenName
        String citizenLineId "Nullable"
        String category "Ref Category name"
        String description
        String location
        Number lat
        Number lng
        String urgency "normal, medium, urgent"
        Number priorityScore "0-100"
        String status "pending, assigned, in_progress, completed, rejected"
        ObjectId assignedTo FK "Ref User (Technician)"
        String assignedName
        String rejectReason
        String citizenImage "Cloudinary/Local URL"
        Array images "List of URLs"
        String beforeImage "Cloudinary/Local URL"
        String afterImage "Cloudinary/Local URL"
        Number rating "1-5"
        String ratingReason
        String ratedAt
        Date slaAssignDeadline
        Date slaCompleteDeadline
        Boolean slaBreached
        Array upvotes "[{userId, createdAt}]"
        Number upvoteCount
        Array followers "[{userId, lineUserId}]"
        Number followerCount
        Date chatExpiresAt
        Date createdAt
        Date updatedAt
    }

    CATEGORY {
        ObjectId _id PK
        String name "UNIQUE (e.g., Road)"
        String label
        String icon
        Array technicianIds "FK (Ref User)"
        Boolean isDefault
        Date createdAt
        Date updatedAt
    }

    COMMENT {
        ObjectId _id PK
        String ticketId "e.g., TKT-00001 (Indexed)"
        ObjectId userId FK "Ref User"
        String userName
        String userRole
        String message "Max 500 chars"
        Date createdAt
        Date updatedAt
    }

    DIRECT_MESSAGE {
        ObjectId _id PK
        ObjectId senderId FK "Ref User"
        String senderName
        String senderRole "citizen, admin"
        ObjectId citizenId FK "Ref User (Indexed compound)"
        String message "Max 500 chars"
        Boolean isRead "default false"
        Date createdAt
        Date updatedAt
    }

    HELP_REQUEST {
        ObjectId _id PK
        String helpId "e.g., HELP-001 (UNIQUE)"
        ObjectId citizenId FK "Ref User"
        String citizenName
        String message
        String status "open, resolved, accepted, cancelled"
        String ticketId "e.g., TKT-00001"
        String ticketCategory
        String ticketLocation
        String ticketDesc
        ObjectId requesterId FK "Ref User"
        String requesterName
        String requesterDept
        String targetDept "Category Name"
        ObjectId acceptedById FK "Ref User"
        String acceptedByName
        Date createdAt
        Date updatedAt
    }

    COUNTER {
        ObjectId _id PK
        String name "UNIQUE (ticket, help)"
        Number seq "Auto-increment value"
    }
```
