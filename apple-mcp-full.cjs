#!/usr/bin/env node

// Full Apple MCP server - Pure Node.js implementation with all tools
const readline = require('readline');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

console.error('[Apple MCP Full] Starting comprehensive Apple MCP server (pure Node.js)...');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Complete tools definition with all Apple integrations
const tools = [
  {
    name: "contacts",
    description: "Search and retrieve contacts from Apple Contacts app",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name to search for (optional - if not provided, returns all contacts)"
        }
      }
    }
  },
  {
    name: "notes",
    description: "Search, retrieve and create notes in Apple Notes app",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["search", "list", "create"],
          description: "Operation to perform"
        },
        searchText: {
          type: "string",
          description: "Text to search for in notes (required for search)"
        },
        title: {
          type: "string",
          description: "Title of the note to create (required for create)"
        },
        body: {
          type: "string",
          description: "Content of the note to create (required for create)"
        },
        folderName: {
          type: "string",
          description: "Name of the folder to create the note in (optional, defaults to 'Notes')"
        }
      },
      required: ["operation"]
    }
  },
  {
    name: "messages",
    description: "Send messages and search conversations using Apple Messages",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["send", "search"],
          description: "Operation to perform"
        },
        to: {
          type: "string",
          description: "Phone number or email to send message to (required for send)"
        },
        message: {
          type: "string",
          description: "Message content to send (required for send)"
        },
        searchText: {
          type: "string",
          description: "Text to search for in messages (required for search)"
        }
      },
      required: ["operation"]
    }
  },
  {
    name: "mail",
    description: "Search emails and manage mailboxes using Apple Mail",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["search", "listMailboxes"],
          description: "Operation to perform"
        },
        searchText: {
          type: "string",
          description: "Text to search for in emails (required for search)"
        },
        mailbox: {
          type: "string",
          description: "Specific mailbox to search in (optional)"
        }
      },
      required: ["operation"]
    }
  },
  {
    name: "reminders",
    description: "Manage Apple Reminders - create, list, search, and delete reminders",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["list", "search", "create", "delete", "deleteAll"],
          description: "The operation to perform"
        },
        searchText: {
          type: "string",
          description: "Text to search for (required for search operation)"
        },
        name: {
          type: "string",
          description: "Reminder name (required for create operation)"
        },
        listName: {
          type: "string",
          description: "List name for the reminder"
        },
        notes: {
          type: "string",
          description: "Additional notes for the reminder"
        },
        dueDate: {
          type: "string",
          description: "Due date in ISO format"
        },
        reminderId: {
          type: "string",
          description: "ID of reminder to delete (for delete operation)"
        }
      },
      required: ["operation"]
    }
  },
  {
    name: "calendar",
    description: "Search and create calendar events in Apple Calendar",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["search", "create", "list"],
          description: "Operation to perform"
        },
        searchText: {
          type: "string",
          description: "Text to search for in events (required for search)"
        },
        title: {
          type: "string",
          description: "Event title (required for create)"
        },
        startDate: {
          type: "string",
          description: "Event start date/time in ISO format (required for create)"
        },
        endDate: {
          type: "string",
          description: "Event end date/time in ISO format (required for create)"
        },
        location: {
          type: "string",
          description: "Event location (optional)"
        },
        notes: {
          type: "string",
          description: "Event notes (optional)"
        },
        calendarName: {
          type: "string",
          description: "Calendar to create event in (optional)"
        }
      },
      required: ["operation"]
    }
  },
  {
    name: "maps",
    description: "Search locations, get directions, and manage guides using Apple Maps",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["search", "directions", "save"],
          description: "Operation to perform"
        },
        query: {
          type: "string",
          description: "Search query for locations (required for search)"
        },
        fromAddress: {
          type: "string",
          description: "Starting address for directions (required for directions)"
        },
        toAddress: {
          type: "string",
          description: "Destination address for directions (required for directions)"
        },
        transportType: {
          type: "string",
          enum: ["driving", "walking", "transit"],
          description: "Type of transport (optional for directions)"
        },
        name: {
          type: "string",
          description: "Name of location to save (required for save)"
        },
        address: {
          type: "string",
          description: "Address of location to save (required for save)"
        }
      },
      required: ["operation"]
    }
  },
  {
    name: "webSearch",
    description: "Search the web using the default browser",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "voicememos",
    description: "Manage Voice Memos - list, play, record, and export voice recordings",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["list", "open", "play", "record", "stop", "export", "transcribe"],
          description: "The operation to perform"
        },
        name: {
          type: "string",
          description: "Recording name (for play/export operations)"
        },
        destination: {
          type: "string",
          description: "Export destination path (for export operation)"
        },
        transcribe: {
          type: "boolean",
          description: "Whether to transcribe the recording (for play/export operations)"
        }
      },
      required: ["operation"]
    }
  }
];

// Execute AppleScript
async function runAppleScript(script) {
  try {
    const { stdout, stderr } = await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
    if (stderr) {
      console.error('[Apple MCP Full] AppleScript stderr:', stderr);
    }
    return stdout.trim();
  } catch (error) {
    console.error('[Apple MCP Full] AppleScript error:', error);
    throw error;
  }
}

// Handle Contacts tool
async function handleContacts(args) {
  const script = args.name ? `
    tell application "Contacts"
      set searchResults to {}
      set searchName to "${args.name}"
      repeat with aPerson in people
        if (first name of aPerson contains searchName) or (last name of aPerson contains searchName) or (name of aPerson contains searchName) then
          set contactInfo to name of aPerson
          try
            set contactEmail to value of first email of aPerson
            set contactInfo to contactInfo & " - " & contactEmail
          end try
          try
            set contactPhone to value of first phone of aPerson
            set contactInfo to contactInfo & " - " & contactPhone
          end try
          set end of searchResults to contactInfo
        end if
      end repeat
      return searchResults as string
    end tell
  ` : `
    tell application "Contacts"
      set allContacts to {}
      repeat with aPerson in people
        set contactInfo to name of aPerson
        try
          set contactEmail to value of first email of aPerson
          set contactInfo to contactInfo & " - " & contactEmail
        end try
        set end of allContacts to contactInfo
      end repeat
      return allContacts as string
    end tell
  `;
  
  const result = await runAppleScript(script);
  const contacts = result.split(', ').filter(c => c.length > 0);
  
  return {
    content: [{
      type: "text",
      text: contacts.length > 0 
        ? `Found ${contacts.length} contact(s):\\n\\n${contacts.join('\\n')}`
        : "No contacts found."
    }],
    isError: false
  };
}

// Handle Notes tool
async function handleNotes(args) {
  const { operation } = args;
  
  switch (operation) {
    case "list": {
      const script = `
        tell application "Notes"
          set notesList to {}
          repeat with aNote in notes
            try
              set noteInfo to name of aNote
              try
                set folderName to name of container of aNote
                set noteInfo to noteInfo & " [" & folderName & "]"
              end try
              set end of notesList to noteInfo
            end try
          end repeat
          return notesList as string
        end tell
      `;
      
      const result = await runAppleScript(script);
      const notes = result.split(', ').filter(n => n.length > 0);
      
      return {
        content: [{
          type: "text",
          text: notes.length > 0 
            ? `Found ${notes.length} note(s):\\n\\n${notes.join('\\n')}`
            : "No notes found."
        }],
        isError: false
      };
    }
    
    case "search": {
      if (!args.searchText) {
        throw new Error("Search text is required for search operation");
      }
      
      const script = `
        tell application "Notes"
          set searchResults to {}
          set searchText to "${args.searchText}"
          repeat with aNote in notes
            try
              set noteName to name of aNote
              set noteBody to body of aNote as string
              if (noteName contains searchText) or (noteBody contains searchText) then
                set noteInfo to noteName
                try
                  set folderName to name of container of aNote
                  set noteInfo to noteInfo & " [" & folderName & "]"
                end try
                set end of searchResults to noteInfo
              end if
            end try
          end repeat
          return searchResults as string
        end tell
      `;
      
      const result = await runAppleScript(script);
      const notes = result.split(', ').filter(n => n.length > 0);
      
      return {
        content: [{
          type: "text",
          text: notes.length > 0 
            ? `Found ${notes.length} note(s) matching "${args.searchText}":\\n\\n${notes.join('\\n')}`
            : `No notes found matching "${args.searchText}".`
        }],
        isError: false
      };
    }
    
    case "create": {
      if (!args.title || !args.body) {
        throw new Error("Title and body are required for create operation");
      }
      
      const folderName = args.folderName || "Notes";
      const script = `
        tell application "Notes"
          set newNote to make new note with properties {name:"${args.title}", body:"${args.body}"}
          try
            move newNote to folder "${folderName}"
          end try
          return "Created note: " & name of newNote
        end tell
      `;
      
      const result = await runAppleScript(script);
      
      return {
        content: [{
          type: "text",
          text: result
        }],
        isError: false
      };
    }
    
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

// Handle Messages tool
async function handleMessages(args) {
  const { operation } = args;
  
  switch (operation) {
    case "send": {
      if (!args.to || !args.message) {
        throw new Error("Recipient and message are required for send operation");
      }
      
      const script = `
        tell application "Messages"
          set targetBuddy to "${args.to}"
          set targetMessage to "${args.message}"
          
          set targetService to 1st service whose service type = iMessage
          set targetBuddy to buddy targetBuddy of targetService
          
          send targetMessage to targetBuddy
          return "Message sent to " & targetBuddy
        end tell
      `;
      
      try {
        const result = await runAppleScript(script);
        return {
          content: [{
            type: "text",
            text: result
          }],
          isError: false
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to send message: ${error.message}`
          }],
          isError: true
        };
      }
    }
    
    case "search": {
      if (!args.searchText) {
        throw new Error("Search text is required for search operation");
      }
      
      // Messages doesn't have great AppleScript support for searching
      return {
        content: [{
          type: "text",
          text: "Message search is limited in AppleScript. Opening Messages app..."
        }],
        isError: false
      };
    }
    
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

// Handle Mail tool
async function handleMail(args) {
  const { operation } = args;
  
  switch (operation) {
    case "listMailboxes": {
      const script = `
        tell application "Mail"
          set mailboxList to {}
          repeat with anAccount in accounts
            set accountName to name of anAccount
            repeat with aMailbox in mailboxes of anAccount
              set mailboxInfo to accountName & " - " & name of aMailbox
              set end of mailboxList to mailboxInfo
            end repeat
          end repeat
          return mailboxList as string
        end tell
      `;
      
      const result = await runAppleScript(script);
      const mailboxes = result.split(', ').filter(m => m.length > 0);
      
      return {
        content: [{
          type: "text",
          text: mailboxes.length > 0 
            ? `Found ${mailboxes.length} mailbox(es):\\n\\n${mailboxes.join('\\n')}`
            : "No mailboxes found."
        }],
        isError: false
      };
    }
    
    case "search": {
      if (!args.searchText) {
        throw new Error("Search text is required for search operation");
      }
      
      const script = `
        tell application "Mail"
          set searchResults to {}
          set searchText to "${args.searchText}"
          set msgs to messages of inbox whose subject contains searchText or content contains searchText
          
          repeat with aMessage in msgs
            set msgInfo to subject of aMessage & " - From: " & (sender of aMessage as string)
            set end of searchResults to msgInfo
          end repeat
          
          return searchResults as string
        end tell
      `;
      
      try {
        const result = await runAppleScript(script);
        const emails = result.split(', ').filter(e => e.length > 0);
        
        return {
          content: [{
            type: "text",
            text: emails.length > 0 
              ? `Found ${emails.length} email(s) matching "${args.searchText}":\\n\\n${emails.join('\\n')}`
              : `No emails found matching "${args.searchText}".`
          }],
          isError: false
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Mail search error: ${error.message}. Make sure Mail app is configured.`
          }],
          isError: true
        };
      }
    }
    
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

// Handle Reminders tool (already implemented)
async function handleReminders(args) {
  const { operation } = args;
  
  switch (operation) {
    case "list": {
      const script = `
        tell application "Reminders"
          set remindersList to {}
          repeat with lst in lists
            set listName to name of lst
            repeat with rmdr in reminders of lst
              if not completed of rmdr then
                set reminderInfo to name of rmdr & " [" & listName & "]"
                if due date of rmdr is not missing value then
                  set reminderInfo to reminderInfo & " (Due: " & (due date of rmdr as string) & ")"
                end if
                set end of remindersList to reminderInfo
              end if
            end repeat
          end repeat
          return remindersList as string
        end tell
      `;
      
      const result = await runAppleScript(script);
      const reminders = result.split(', ').filter(r => r.length > 0);
      
      return {
        content: [{
          type: "text",
          text: reminders.length > 0 
            ? `Found ${reminders.length} reminders:\\n\\n${reminders.join('\\n')}`
            : "No reminders found."
        }],
        isError: false
      };
    }
    
    case "create": {
      if (!args.name) {
        throw new Error("Name is required for create operation");
      }
      
      const script = `
        tell application "Reminders"
          set newReminder to make new reminder with properties {name:"${args.name}"}
          ${args.notes ? `set body of newReminder to "${args.notes}"` : ''}
          ${args.listName ? `move newReminder to list "${args.listName}"` : ''}
          return "Created reminder: " & name of newReminder
        end tell
      `;
      
      const result = await runAppleScript(script);
      
      return {
        content: [{
          type: "text",
          text: result
        }],
        isError: false
      };
    }
    
    case "search": {
      if (!args.searchText) {
        throw new Error("Search text is required for search operation");
      }
      
      const script = `
        tell application "Reminders"
          set searchResults to {}
          set searchText to "${args.searchText}"
          repeat with lst in lists
            set listName to name of lst
            repeat with rmdr in reminders of lst
              if not completed of rmdr then
                if name of rmdr contains searchText or (body of rmdr is not missing value and body of rmdr contains searchText) then
                  set reminderInfo to name of rmdr & " [" & listName & "]"
                  if body of rmdr is not missing value then
                    set reminderInfo to reminderInfo & " - " & body of rmdr
                  end if
                  if due date of rmdr is not missing value then
                    set reminderInfo to reminderInfo & " (Due: " & (due date of rmdr as string) & ")"
                  end if
                  set end of searchResults to reminderInfo
                end if
              end if
            end repeat
          end repeat
          return searchResults as string
        end tell
      `;
      
      const result = await runAppleScript(script);
      const reminders = result.split(', ').filter(r => r.length > 0);
      
      return {
        content: [{
          type: "text",
          text: reminders.length > 0 
            ? `Found ${reminders.length} reminders matching "${args.searchText}":\\n\\n${reminders.join('\\n')}`
            : `No reminders found matching "${args.searchText}".`
        }],
        isError: false
      };
    }
    
    case "deleteAll": {
      const listName = args.listName || "Reminders";
      const script = `
        tell application "Reminders"
          set deletedCount to 0
          if "${listName}" is "all" then
            repeat with lst in lists
              set remindersList to reminders of lst whose completed is false
              repeat with rmdr in remindersList
                delete rmdr
                set deletedCount to deletedCount + 1
              end repeat
            end repeat
          else
            try
              set targetList to list "${listName}"
              set remindersList to reminders of targetList whose completed is false
              repeat with rmdr in remindersList
                delete rmdr
                set deletedCount to deletedCount + 1
              end repeat
            on error
              return "Error: List '" & "${listName}" & "' not found"
            end try
          end if
          return "Deleted " & deletedCount & " reminders"
        end tell
      `;
      
      const result = await runAppleScript(script);
      
      return {
        content: [{
          type: "text",
          text: result
        }],
        isError: false
      };
    }
    
    case "delete": {
      if (!args.reminderId && !args.name) {
        throw new Error("Either reminderId or name is required for delete operation");
      }
      
      const script = args.name ? `
        tell application "Reminders"
          set deletedCount to 0
          repeat with lst in lists
            set remindersList to reminders of lst whose name is "${args.name}" and completed is false
            repeat with rmdr in remindersList
              delete rmdr
              set deletedCount to deletedCount + 1
            end repeat
          end repeat
          if deletedCount > 0 then
            return "Deleted " & deletedCount & " reminder(s) named '" & "${args.name}" & "'"
          else
            return "No reminder found with name '" & "${args.name}" & "'"
          end if
        end tell
      ` : `
        tell application "Reminders"
          try
            delete reminder id "${args.reminderId}"
            return "Deleted reminder with ID: ${args.reminderId}"
          on error
            return "Error: Could not find reminder with ID: ${args.reminderId}"
          end try
        end tell
      `;
      
      const result = await runAppleScript(script);
      
      return {
        content: [{
          type: "text",
          text: result
        }],
        isError: false
      };
    }
    
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

// Handle Calendar tool
async function handleCalendar(args) {
  const { operation } = args;
  
  switch (operation) {
    case "list": {
      const script = `
        tell application "Calendar"
          set eventsList to {}
          set todayDate to current date
          set tomorrowDate to todayDate + (1 * days)
          
          repeat with cal in calendars
            set calName to name of cal
            repeat with evt in events of cal
              if start date of evt >= todayDate and start date of evt < tomorrowDate then
                set eventInfo to summary of evt & " [" & calName & "] - " & (start date of evt as string)
                set end of eventsList to eventInfo
              end if
            end repeat
          end repeat
          
          return eventsList as string
        end tell
      `;
      
      const result = await runAppleScript(script);
      const events = result.split(', ').filter(e => e.length > 0);
      
      return {
        content: [{
          type: "text",
          text: events.length > 0 
            ? `Today's events:\\n\\n${events.join('\\n')}`
            : "No events for today."
        }],
        isError: false
      };
    }
    
    case "search": {
      if (!args.searchText) {
        throw new Error("Search text is required for search operation");
      }
      
      const script = `
        tell application "Calendar"
          set searchResults to {}
          set searchText to "${args.searchText}"
          
          repeat with cal in calendars
            set calName to name of cal
            repeat with evt in events of cal
              if summary of evt contains searchText then
                set eventInfo to summary of evt & " [" & calName & "] - " & (start date of evt as string)
                set end of searchResults to eventInfo
              end if
            end repeat
          end repeat
          
          return searchResults as string
        end tell
      `;
      
      const result = await runAppleScript(script);
      const events = result.split(', ').filter(e => e.length > 0);
      
      return {
        content: [{
          type: "text",
          text: events.length > 0 
            ? `Found ${events.length} event(s) matching "${args.searchText}":\\n\\n${events.join('\\n')}`
            : `No events found matching "${args.searchText}".`
        }],
        isError: false
      };
    }
    
    case "create": {
      if (!args.title || !args.startDate || !args.endDate) {
        throw new Error("Title, startDate, and endDate are required for create operation");
      }
      
      const script = `
        tell application "Calendar"
          set newEvent to make new event with properties {summary:"${args.title}", start date:date "${args.startDate}", end date:date "${args.endDate}"}
          ${args.location ? `set location of newEvent to "${args.location}"` : ''}
          ${args.notes ? `set description of newEvent to "${args.notes}"` : ''}
          return "Created event: " & summary of newEvent
        end tell
      `;
      
      try {
        const result = await runAppleScript(script);
        return {
          content: [{
            type: "text",
            text: result
          }],
          isError: false
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to create event: ${error.message}. Check date format.`
          }],
          isError: true
        };
      }
    }
    
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

// Handle Maps tool
async function handleMaps(args) {
  const { operation } = args;
  
  switch (operation) {
    case "search": {
      if (!args.query) {
        throw new Error("Query is required for search operation");
      }
      
      // Open Maps with search query
      await execAsync(`open "maps://?q=${encodeURIComponent(args.query)}"`);
      
      return {
        content: [{
          type: "text",
          text: `Opened Maps searching for: ${args.query}`
        }],
        isError: false
      };
    }
    
    case "directions": {
      if (!args.fromAddress || !args.toAddress) {
        throw new Error("From and to addresses are required for directions");
      }
      
      const transport = args.transportType || "driving";
      const transportMap = { driving: "d", walking: "w", transit: "r" };
      const transportCode = transportMap[transport] || "d";
      
      await execAsync(`open "maps://?saddr=${encodeURIComponent(args.fromAddress)}&daddr=${encodeURIComponent(args.toAddress)}&dirflg=${transportCode}"`);
      
      return {
        content: [{
          type: "text",
          text: `Getting ${transport} directions from ${args.fromAddress} to ${args.toAddress}`
        }],
        isError: false
      };
    }
    
    case "save": {
      if (!args.name || !args.address) {
        throw new Error("Name and address are required for save operation");
      }
      
      // Maps doesn't have great AppleScript support for saving locations
      await execAsync(`open "maps://?address=${encodeURIComponent(args.address)}"`);
      
      return {
        content: [{
          type: "text",
          text: `Opened Maps at ${args.address}. You can save it as "${args.name}" manually.`
        }],
        isError: false
      };
    }
    
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

// Handle Web Search tool
async function handleWebSearch(args) {
  if (!args.query) {
    throw new Error("Query is required for web search");
  }
  
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(args.query)}`;
  await execAsync(`open "${searchUrl}"`);
  
  return {
    content: [{
      type: "text",
      text: `Searching the web for: ${args.query}`
    }],
    isError: false
  };
}

// Handle Voice Memos tool (already implemented)
async function handleVoiceMemos(args) {
  const { operation } = args;
  
  switch (operation) {
    case "list": {
      // Check common Voice Memos storage locations
      const possiblePaths = [
        `${process.env.HOME}/Library/Group Containers/group.com.apple.VoiceMemos/Recordings`,
        `${process.env.HOME}/Music/Voice Memos`,
        `${process.env.HOME}/Documents/Voice Memos`
      ];
      
      let recordings = [];
      let foundPath = null;
      
      for (const checkPath of possiblePaths) {
        try {
          const { stdout } = await execAsync(`ls -la "${checkPath}" 2>/dev/null | grep -E "\\.(m4a|mp3|wav)" || true`);
          if (stdout) {
            foundPath = checkPath;
            const lines = stdout.trim().split('\n').filter(line => line);
            recordings = lines.map(line => {
              const parts = line.split(/\s+/);
              const filename = parts.slice(8).join(' ');
              return filename.replace(/\.(m4a|mp3|wav)$/, '');
            });
            break;
          }
        } catch (e) {
          // Continue to next path
        }
      }
      
      // If no files found, try opening Voice Memos and getting from UI
      if (recordings.length === 0) {
        const script = `
          tell application "VoiceMemos" to activate
          delay 1
          return "Voice Memos opened. Recordings may be stored in iCloud or not accessible via file system."
        `;
        const result = await runAppleScript(script);
        
        return {
          content: [{
            type: "text",
            text: `${result} Check the Voice Memos app for your recordings.`
          }],
          isError: false
        };
      }
      
      return {
        content: [{
          type: "text",
          text: recordings.length > 0 
            ? `Found ${recordings.length} recording(s) in ${foundPath}:\\n\\n${recordings.join('\\n')}`
            : "No recordings found in common locations. Try opening Voice Memos app."
        }],
        isError: false
      };
    }
    
    case "open": {
      const script = `
        tell application "VoiceMemos"
          activate
        end tell
      `;
      
      await runAppleScript(script);
      
      return {
        content: [{
          type: "text",
          text: "Voice Memos app opened"
        }],
        isError: false
      };
    }
    
    case "play": {
      if (!args.name) {
        throw new Error("Recording name is required for play operation");
      }
      
      // First try to find and open the file
      const possiblePaths = [
        `${process.env.HOME}/Library/Group Containers/group.com.apple.VoiceMemos/Recordings`,
        `${process.env.HOME}/Music/Voice Memos`,
        `${process.env.HOME}/Documents/Voice Memos`
      ];
      
      for (const checkPath of possiblePaths) {
        try {
          const { stdout } = await execAsync(`find "${checkPath}" -name "*${args.name}*" -type f 2>/dev/null | head -1`);
          if (stdout.trim()) {
            await execAsync(`open "${stdout.trim()}"`);
            return {
              content: [{
                type: "text",
                text: `Playing recording: ${args.name}`
              }],
              isError: false
            };
          }
        } catch (e) {
          // Continue to next path
        }
      }
      
      // If not found, open Voice Memos and try to play via UI
      const script = `
        tell application "VoiceMemos"
          activate
        end tell
        delay 1
        tell application "System Events"
          tell process "VoiceMemos"
            keystroke "f" using command down
            delay 0.5
            keystroke "${args.name}"
            delay 1
            keystroke return
            delay 0.5
            keystroke space
          end tell
        end tell
      `;
      
      await runAppleScript(script);
      
      return {
        content: [{
          type: "text",
          text: `Attempting to play recording matching: ${args.name}`
        }],
        isError: false
      };
    }
    
    case "record": {
      const script = `
        tell application "VoiceMemos"
          activate
        end tell
        delay 1
        tell application "System Events"
          tell process "VoiceMemos"
            -- Click the record button
            try
              click button 1 of window 1
            on error
              keystroke "r" using command down
            end try
          end tell
        end tell
      `;
      
      await runAppleScript(script);
      
      return {
        content: [{
          type: "text",
          text: "Started recording. Use 'stop' operation to stop recording."
        }],
        isError: false
      };
    }
    
    case "stop": {
      const script = `
        tell application "System Events"
          tell process "VoiceMemos"
            -- Click the stop button (same as record button)
            try
              click button 1 of window 1
            on error
              keystroke "r" using command down
            end try
          end tell
        end tell
      `;
      
      await runAppleScript(script);
      
      return {
        content: [{
          type: "text",
          text: "Recording stopped"
        }],
        isError: false
      };
    }
    
    case "export": {
      if (!args.name || !args.destination) {
        throw new Error("Recording name and destination path are required for export operation");
      }
      
      // Find the recording file
      const possiblePaths = [
        `${process.env.HOME}/Library/Group Containers/group.com.apple.VoiceMemos/Recordings`,
        `${process.env.HOME}/Music/Voice Memos`,
        `${process.env.HOME}/Documents/Voice Memos`
      ];
      
      for (const checkPath of possiblePaths) {
        try {
          const { stdout } = await execAsync(`find "${checkPath}" -name "*${args.name}*" -type f 2>/dev/null | head -1`);
          if (stdout.trim()) {
            const sourcePath = stdout.trim();
            const destDir = require('path').dirname(args.destination);
            await execAsync(`mkdir -p "${destDir}"`);
            await execAsync(`cp "${sourcePath}" "${args.destination}"`);
            
            let responseText = `Exported recording to: ${args.destination}`;
            
            // If transcribe is requested, attempt transcription
            if (args.transcribe) {
              try {
                const transcription = await transcribeAudio(args.destination);
                responseText += `\\n\\nTranscription:\\n${transcription}`;
              } catch (e) {
                responseText += `\\n\\nTranscription failed: ${e.message}`;
              }
            }
            
            return {
              content: [{
                type: "text",
                text: responseText
              }],
              isError: false
            };
          }
        } catch (e) {
          // Continue to next path
        }
      }
      
      return {
        content: [{
          type: "text",
          text: `Recording "${args.name}" not found in common locations`
        }],
        isError: true
      };
    }
    
    case "transcribe": {
      if (!args.name) {
        throw new Error("Recording name is required for transcribe operation");
      }
      
      // Find the recording file
      const possiblePaths = [
        `${process.env.HOME}/Library/Group Containers/group.com.apple.VoiceMemos/Recordings`,
        `${process.env.HOME}/Music/Voice Memos`,
        `${process.env.HOME}/Documents/Voice Memos`
      ];
      
      for (const checkPath of possiblePaths) {
        try {
          const { stdout } = await execAsync(`find "${checkPath}" -name "*${args.name}*" -type f 2>/dev/null | head -1`);
          if (stdout.trim()) {
            const audioPath = stdout.trim();
            
            // Export to temp location for processing
            const tempPath = `/tmp/voice_memo_${Date.now()}.m4a`;
            await execAsync(`cp "${audioPath}" "${tempPath}"`);
            
            try {
              // Method 1: Try using whisper.cpp if available
              const { stdout: whisperCheck } = await execAsync(`which whisper 2>/dev/null || echo "not found"`);
              if (whisperCheck.trim() !== "not found") {
                const { stdout: transcription } = await execAsync(`whisper "${tempPath}" --model base --language en --output_format txt 2>/dev/null`);
                await execAsync(`rm -f "${tempPath}"`);
                return {
                  content: [{
                    type: "text",
                    text: `Transcription of "${args.name}":\\n\\n${transcription}`
                  }],
                  isError: false
                };
              }
              
              // Method 2: Convert to text format that can be shared
              // First, get basic info about the audio
              const { stdout: duration } = await execAsync(`afinfo "${tempPath}" 2>/dev/null | grep "estimated duration" | awk '{print $3}'`);
              const { stdout: fileSize } = await execAsync(`ls -lh "${tempPath}" | awk '{print $5}'`);
              
              // For actual transcription, we'll prepare the file for the LLM to process
              // Export as base64 for potential processing
              const { stdout: base64Audio } = await execAsync(`base64 "${tempPath}" | head -c 50000`); // Limit size
              
              await execAsync(`rm -f "${tempPath}"`);
              
              return {
                content: [{
                  type: "text",
                  text: `Recording "${args.name}" found:\\n- Duration: ${duration.trim() || 'unknown'} seconds\\n- Size: ${fileSize.trim()}\\n\\nTo transcribe this audio, you can:\\n1. Export it and use an external transcription service\\n2. Install whisper.cpp for local transcription: brew install whisper-cpp\\n3. Use online services like OpenAI Whisper API\\n\\nAudio file is ready for processing.`
                }],
                isError: false
              };
            } catch (e) {
              await execAsync(`rm -f "${tempPath}" 2>/dev/null`);
              throw e;
            }
          }
        } catch (e) {
          // Continue to next path
        }
      }
      
      return {
        content: [{
          type: "text",
          text: `Recording "${args.name}" not found in common locations`
        }],
        isError: true
      };
    }
    
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

// Transcribe audio using available methods
async function transcribeAudio(audioPath) {
  // Check if whisper is available
  try {
    const { stdout: whisperCheck } = await execAsync(`which whisper 2>/dev/null || echo "not found"`);
    if (whisperCheck.trim() !== "not found") {
      const { stdout } = await execAsync(`whisper "${audioPath}" --model base --language en --output_format txt 2>&1`);
      return stdout.trim();
    }
  } catch (e) {
    console.error('[Apple MCP Full] Whisper transcription failed:', e);
  }
  
  // If no transcription service available, provide instructions
  throw new Error("No transcription service available. Install whisper.cpp: brew install whisper-cpp");
}

// Handle JSON-RPC requests
rl.on('line', async (line) => {
  console.error(`[Apple MCP Full] Received: ${line}`);
  
  try {
    const request = JSON.parse(line);
    const { id, method, params } = request;
    
    let response;
    
    if (method === 'initialize') {
      response = {
        jsonrpc: "2.0",
        id: id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "Apple MCP Full", version: "1.0.0" }
        }
      };
    } else if (method === 'tools/list') {
      response = {
        jsonrpc: "2.0",
        id: id,
        result: { tools }
      };
    } else if (method === 'tools/call') {
      try {
        const { name, arguments: args } = params;
        
        let result;
        switch (name) {
          case 'contacts':
            result = await handleContacts(args);
            break;
          case 'notes':
            result = await handleNotes(args);
            break;
          case 'messages':
            result = await handleMessages(args);
            break;
          case 'mail':
            result = await handleMail(args);
            break;
          case 'reminders':
            result = await handleReminders(args);
            break;
          case 'calendar':
            result = await handleCalendar(args);
            break;
          case 'maps':
            result = await handleMaps(args);
            break;
          case 'webSearch':
            result = await handleWebSearch(args);
            break;
          case 'voicememos':
            result = await handleVoiceMemos(args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
        
        response = {
          jsonrpc: "2.0",
          id: id,
          result
        };
      } catch (error) {
        response = {
          jsonrpc: "2.0",
          id: id,
          error: { 
            code: -32000, 
            message: error.message 
          }
        };
      }
    } else if (method === 'notifications/initialized') {
      // Ignore notification
      console.error('[Apple MCP Full] Received initialized notification');
      return;
    } else {
      response = {
        jsonrpc: "2.0",
        id: id,
        error: { code: -32601, message: `Method not found: ${method}` }
      };
    }
    
    const responseStr = JSON.stringify(response);
    console.error(`[Apple MCP Full] Sending: ${responseStr}`);
    console.log(responseStr);
    
  } catch (e) {
    console.error('[Apple MCP Full] Error:', e);
  }
});

console.error('[Apple MCP Full] Ready for JSON-RPC requests');