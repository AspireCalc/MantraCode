import { useDialog } from "../../providers/dialog";
import { DialogSearchList } from "../dialog-search-list";
import { useCallback } from "react";
import { Mode } from "@aspirenx/mantracode-database/enums";

const AVAILABLE_MODES: Mode[] = [Mode.BUILD, Mode.PLAN];

type AgentsDialogContentProps = {
  currentMode: Mode;
  onSelectMode: (mode: Mode) => void;
};

function getModeLabel(mode: Mode) {
  return mode === Mode.PLAN ? "Plan" : "Build";
}

export const AgentsDialogContent = ({ currentMode, onSelectMode }: AgentsDialogContentProps) => {
  const dialog = useDialog();

  const handleSelect = useCallback((nextMode: Mode) => {
    onSelectMode(nextMode);
    dialog.close();
  }, [onSelectMode, dialog]);

  return (
    <DialogSearchList
      items={AVAILABLE_MODES}
      onSelect={handleSelect}
      filterFn={(modeItem, query) => getModeLabel(modeItem).toLowerCase().includes(query.toLowerCase())}
      renderItem={(modeItem, isSelected) => (
        <text selectable={false} fg={isSelected ? "black" : "white"}>
          {modeItem === currentMode ? " • " : "   "}
          {getModeLabel(modeItem)}
        </text>
      )}
      getkey={(modeItem) => modeItem}
      placeholder="Search agents"
      emptyText="No matching agents found"
    />
  )
}