/**
 * TypeScript Examples for MantraCode
 * 
 * This file contains standard, intermediate, and advanced TypeScript patterns
 * including interfaces, generics, async/await, utility types, and object-oriented
 * programming.
 * 
 * To run this file, use:
 *   bun example.ts
 */

// ==========================================
// 1. Interfaces & Type Aliases
// ==========================================

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
}

// Interface inheritance
interface Session extends User {
  token: string;
  createdAt: Date;
}

const activeSession: Session = {
  id: "session-90812",
  name: "Alice Smith",
  email: "alice@example.com",
  role: "admin",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  createdAt: new Date(),
};


// ==========================================
// 2. Generics & Custom Data Structures
// ==========================================

/**
 * A type-safe API Response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

/**
 * A generic Repository pattern example
 */
class Repository<T extends { id: string }> {
  private items: Map<string, T> = new Map();

  create(item: T): void {
    this.items.set(item.id, item);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  getAll(): T[] {
    return Array.from(this.items.values());
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }
}

// Instantiate the Repository with User
const userRepository = new Repository<User>();
userRepository.create({ id: "1", name: "Bob", email: "bob@example.com", role: "user" });
userRepository.create({ id: "2", name: "Charlie", email: "charlie@example.com", role: "guest" });


// ==========================================
// 3. Advanced Utility Types & Mapped Types
// ==========================================

// Partial: Makes all properties in T optional
// Omit: Creates a type by picking all properties from T and then removing keys
type UpdateUserInput = Partial<Omit<User, 'id'>>;

const updateProfile = (userId: string, updates: UpdateUserInput) => {
  console.log(`Updating user ${userId} with keys:`, Object.keys(updates));
  // In a real app, you would persist this update
};

// Record: Construct a type with properties of Keys and values of Type
const roleDescriptions: Record<User['role'], string> = {
  admin: "Full administrative permissions",
  user: "Regular interactive permissions",
  guest: "Read-only access limits",
};


// ==========================================
// 4. Asynchronous Programming & Promises
// ==========================================

/**
 * Simulates fetching data from a remote endpoint
 */
async function fetchUserById(id: string): Promise<ApiResponse<User>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const user = userRepository.get(id);
      if (user) {
        resolve({
          success: true,
          data: user,
          timestamp: Date.now(),
        });
      } else {
        resolve({
          success: false,
          error: `User with ID ${id} not found`,
          timestamp: Date.now(),
        });
      }
    }, 500); // 500ms delay
  });
}


// ==========================================
// 5. Execution Demo (Entry Point)
// ==========================================

async function runDemo() {
  console.log("🚀 Starting TypeScript Examples Demo...\n");

  // Displaying current Session details
  console.log("--- 1. Session Details (Interface Inheritance) ---");
  console.log(`User: ${activeSession.name} (${activeSession.role})`);
  console.log(`Created at: ${activeSession.createdAt.toISOString()}`);
  console.log();

  // Using the generic Repository
  console.log("--- 2. Repository & Generics ---");
  console.log("All registered users in repository:");
  console.log(userRepository.getAll());
  console.log();

  // Simulating User Profile updates (Utility types)
  console.log("--- 3. Utility Types & Validation ---");
  const updatePayload: UpdateUserInput = { name: "Robert", role: "admin" };
  updateProfile("1", updatePayload);
  console.log("Role descriptions lookup:", roleDescriptions.admin);
  console.log();

  // Simulating async/await
  console.log("--- 4. Async / Await with Promises ---");
  console.log("Fetching user '1' (should succeed)...");
  const response1 = await fetchUserById("1");
  console.log("Response 1 success:", response1.success);
  console.log("Response 1 data:", response1.data);
  console.log();

  console.log("Fetching user '999' (should fail)...");
  const response2 = await fetchUserById("999");
  console.log("Response 2 success:", response2.success);
  console.log("Response 2 error message:", response2.error);
  console.log();

  console.log("🎉 All demonstrations completed successfully!");
}

// Run the demo
runDemo();
