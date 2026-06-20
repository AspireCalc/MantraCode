import { useDialog } from "../../providers/dialog";
import { DialogSearchList } from "../dialog-search-list";
import { useCallback } from "react";
import type { SupportedChatModelId } from "@aspirenx/mantracode-shared";

type ModelsDialogContentProps = {
  models: SupportedChatModelId[];
  onSelectModel: (model: SupportedChatModelId) => void;
  currentModel: SupportedChatModelId;
};

export const ModelsDialogContent = ({ models, onSelectModel, currentModel }: ModelsDialogContentProps) => {
  const dialog = useDialog();

  const handleSelect = useCallback((modelId: SupportedChatModelId) => {
    onSelectModel(modelId);
    dialog.close();
  }, [onSelectModel, dialog]);

  return (
    <DialogSearchList
      items={models}
      onSelect={handleSelect}
      filterFn={(modelId, query) => modelId.toLowerCase().includes(query.toLowerCase())}
      renderItem={(modelId, isSelected) => (
        <text selectable={false} fg={isSelected ? "black" : "white"}>
          {modelId === currentModel ? "• " : "  "}{modelId}
        </text>
      )}
      getkey={(modelId) => modelId}
      placeholder="Search models"
      emptyText="No matching models found"
    />
  )
}