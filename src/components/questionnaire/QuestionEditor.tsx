import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { QuestionItem, AnswerType, ANSWER_TYPE_LABELS } from '@/types/questionnaire';

interface QuestionEditorProps {
  question?: QuestionItem;
  onSave: (question: QuestionItem) => void;
  onCancel: () => void;
  nextOrder: number;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  onSave,
  onCancel,
  nextOrder
}) => {
  const [questionText, setQuestionText] = useState(question?.text || '');
  const [answerType, setAnswerType] = useState<AnswerType>(question?.answerType || 'singleLine');
  const [options, setOptions] = useState<string[]>(question?.options || []);
  const [newOption, setNewOption] = useState('');
  const [required, setRequired] = useState(question?.required || false);

  const isSelectType = answerType === 'singleSelect' || answerType === 'multiSelect';

  const handleAddOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!questionText.trim()) {
      return;
    }

    const questionData: QuestionItem = {
      id: question?.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: questionText.trim(),
      order: question?.order || nextOrder,
      answerType,
      required,
      ...(isSelectType ? { options } : {})
    };

    onSave(questionData);
  };

  const canSave = questionText.trim() && (!isSelectType || options.length > 0);

  return (
    <Card className="border-2 border-dashed border-muted-foreground/25">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="question-text">Question Text *</Label>
          <Input
            id="question-text"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Enter your question..."
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground">
            {questionText.length}/200 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="answer-type">Answer Type *</Label>
          <Select value={answerType} onValueChange={(value: AnswerType) => {
            setAnswerType(value);
            if (value !== 'singleSelect' && value !== 'multiSelect') {
              setOptions([]);
            }
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ANSWER_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isSelectType && (
          <div className="space-y-3">
            <Label>Options *</Label>
            
            {/* Existing Options */}
            {options.length > 0 && (
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...options];
                        newOptions[index] = e.target.value;
                        setOptions(newOptions);
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveOption(index)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Option */}
            <div className="flex gap-2">
              <Input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Enter option text..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOption();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                disabled={!newOption.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {options.length === 0 && (
              <p className="text-sm text-muted-foreground">
                At least one option is required for select questions.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="required"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="required" className="text-sm">
            Required question
          </Label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            size="sm"
          >
            {question ? 'Update' : 'Add'} Question
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            size="sm"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
