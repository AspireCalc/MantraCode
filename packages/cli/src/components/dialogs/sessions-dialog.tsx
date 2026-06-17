import { isToday, isYesterday, differenceInDays } from "date-fns";
import type { InferResponseType } from "hono";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../lib/api-client";
import { useDialog } from "../../providers/dialog";
import { useLocation, useNavigate } from "react-router";
import { useToast } from "../../providers/toast";
import { getErrorMessage } from "../../lib/https-errors";
import { TextAttributes, type InputRenderable, type ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useKeyboardLayer } from "../../providers/keyboard-layer";
import { useTheme } from "../../providers/theme";

type Session = InferResponseType<(typeof apiClient.sessions)["$get"], 200>[number];

type SectionEntry = { type: "header"; label: string };
type ItemEntry = { type: "item"; session: Session; id: string };
type SpacerEntry = { type: "spacer" };
type ListEntry = SectionEntry | ItemEntry | SpacerEntry;

const MAX_VISIBLE_ITEMS = 16;

function getSessionCategory(date: Date): string {
  const now = new Date();
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const diffDays = differenceInDays(now, date);
  if (diffDays <= 7) return "Last 7 days";
  if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
    return "This month";
  }
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (date >= lastMonth && date < new Date(now.getFullYear(), now.getMonth(), 1)) {
    return "Last month";
  }
  if (date.getFullYear() === now.getFullYear()) {
    return "This year";
  }
  if (date.getFullYear() === now.getFullYear() - 1) {
    return "Last year";
  }
  return String(date.getFullYear());
}

const CATEGORY_ORDER: Record<string, number> = {
  "Today": 0,
  "Yesterday": 1,
  "Last 7 days": 2,
  "This month": 3,
  "Last month": 4,
  "This year": 5,
  "Last year": 6,
};

function categoryRank(cat: string): number {
  return CATEGORY_ORDER[cat] ?? (7 + parseInt(cat, 10) || 99);
}

function buildList(sessions: Session[], searchValue: string, currentSessionId?: string): { entries: ListEntry[]; itemIds: string[] } {
  const filtered = sessions.filter((s) =>
    !searchValue || s.title.toLowerCase().includes(searchValue.toLowerCase()),
  );

  const groups = new Map<string, Session[]>();
  for (const s of filtered) {
    const cat = getSessionCategory(new Date(s.createdAt));
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(s);
  }

  const sortedCategories = [...groups.keys()].sort((a, b) => categoryRank(a) - categoryRank(b));

  const entries: ListEntry[] = [];
  const itemIds: string[] = [];

  for (const cat of sortedCategories) {
    const items = groups.get(cat)!;
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (!searchValue || items.length > 0) {
      if (entries.length > 0) entries.push({ type: "spacer" });
      entries.push({ type: "header", label: cat });
    }
    for (const s of items) {
      entries.push({ type: "item", session: s, id: s.id });
      itemIds.push(s.id);
    }
  }

  return { entries, itemIds };
}

export const SessionDialogContent = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<InputRenderable>(null);
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const { close } = useDialog();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { show } = useToast();
  const { colors } = useTheme();
  const { isTopLayer } = useKeyboardLayer();

  const currentSessionId = pathname.startsWith("/sessions/") ? pathname.split("/")[2] : undefined;

  useEffect(() => {
    let ignore = false;

    const fetchSessions = async () => {
      try {
        const res = await apiClient.sessions.$get();
        if (!res.ok) {
          throw new Error(await getErrorMessage(res));
        }

        const data = await res.json();

        if (!ignore) {
          setSessions(data);
          setLoading(false);
        }
      } catch (error) {
        if (!ignore) {
          show({
            variant: "error",
            message: error instanceof Error ? error.message : "Failed to fetch sessions",
          });
          close();
        }
      }
    };

    fetchSessions();

    return () => {
      ignore = true;
    }
  }, [close, show]);

  const { entries, itemIds } = buildList(sessions, searchValue, currentSessionId);

  const filteredItemCount = itemIds.length;
  const visibleHeight = Math.min(filteredItemCount + entries.filter(e => e.type === "header").length, MAX_VISIBLE_ITEMS);

  const handleContentChange = useCallback(() => {
    const text = inputRef.current?.value ?? "";
    setSearchValue(text);
    setSelectedIndex(0);
    const sb = scrollRef.current;
    if (sb) sb.scrollTo(0);
  }, []);

  const resolveItemIndex = useCallback((listIndex: number): number | null => {
    let itemIdx = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i]!.type === "header") continue;
      if (i === listIndex) return itemIdx;
      itemIdx++;
    }
    return null;
  }, [entries]);

  const resolveListIndex = useCallback((itemIndex: number): number | null => {
    let itemIdx = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i]!.type === "header") continue;
      if (itemIdx === itemIndex) return i;
      itemIdx++;
    }
    return null;
  }, [entries]);

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;

    if (key.name === "return" || key.name === "enter") {
      const entry = entries[selectedIndex];
      if (entry?.type === "item") {
        close();
        navigate(`/sessions/${entry.session.id}`);
      }
    } else if (key.name === "up") {
      setSelectedIndex((i) => {
        let newIdx = i - 1;
        while (newIdx >= 0 && (entries[newIdx]?.type === "header" || entries[newIdx]?.type === "spacer")) newIdx--;
        newIdx = Math.max(0, newIdx);
        const sb = scrollRef.current;
        if (sb && newIdx < sb.scrollTop) sb.scrollTo(newIdx);
        return newIdx;
      });
    } else if (key.name === "down") {
      setSelectedIndex((i) => {
        let newIdx = i + 1;
        while (newIdx < entries.length && (entries[newIdx]?.type === "header" || entries[newIdx]?.type === "spacer")) newIdx++;
        newIdx = Math.min(entries.length - 1, newIdx);
        const sb = scrollRef.current;
        if (sb) {
          const viewportHeight = sb.viewport.height;
          const visibleEnd = sb.scrollTop + viewportHeight - 1;
          if (newIdx > visibleEnd) sb.scrollTo(newIdx - viewportHeight + 1);
        }
        return newIdx;
      });
    }
  });

  if (loading) {
    return (
      <box flexDirection="column">
        <text attributes={TextAttributes.DIM}>Loading sessions...</text>
      </box>
    )
  }

  return (
    <box flexDirection="column" gap={1}>
      <input
        ref={inputRef}
        placeholder="Search sessions"
        focused
        onContentChange={handleContentChange}
      />
      {entries.length === 0 ? (
        <text attributes={TextAttributes.DIM}>No matching sessions</text>
      ) : (
        <scrollbox ref={scrollRef} height={visibleHeight}>
          {entries.map((entry, i) => {
            if (entry.type === "spacer") {
              return <box key={`s:${i}`} height={2} />;
            }

            if (entry.type === "header") {
              return (
                <box key={`h:${entry.label}`} flexDirection="row" height={1} paddingLeft={1}>
                  <text selectable={false} fg={colors.primary} attributes={TextAttributes.BOLD}>
                    {entry.label}
                  </text>
                </box>
              );
            }

            const isSelected = i === selectedIndex;
            const isCurrent = entry.session.id === currentSessionId;

            return (
              <box
                key={entry.session.id}
                flexDirection="row"
                height={1}
                overflow="hidden"
                backgroundColor={isSelected ? colors.selection : undefined}
                onMouseMove={() => setSelectedIndex(i)}
                onMouseDown={() => {
                  close();
                  navigate(`/sessions/${entry.session.id}`);
                }}
              >
                <text selectable={false} fg={isSelected ? "black" : "white"}>
                  {isCurrent ? "• " : "  "}
                </text>
                <text selectable={false} fg={isSelected ? "black" : "white"}>
                  {entry.session.title}
                </text>
                <box flexGrow={1} />
              </box>
            );
          })}
        </scrollbox>
      )}
    </box>
  )
}