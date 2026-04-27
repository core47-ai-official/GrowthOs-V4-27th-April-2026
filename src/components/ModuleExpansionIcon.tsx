import { 
  ChevronUp, 
  ChevronDown, 
  ArrowDown, 
  ArrowRight, 
  Plus, 
  Minus, 
  Triangle, 
  Square 
} from "lucide-react";

interface ModuleExpansionIconProps {
  moduleIndex: number;
  isExpanded: boolean;
}

export const ModuleExpansionIcon = ({ moduleIndex, isExpanded }: ModuleExpansionIconProps) => {
  const iconConfigs = [
    { 
      expanded: <ChevronUp className="h-5 w-5 text-blue-600 transition-all duration-300 hover:scale-110" />, 
      collapsed: <ChevronDown className="h-5 w-5 text-blue-600 transition-all duration-300 hover:scale-110" /> 
    },
    { 
      expanded: <Minus className="h-5 w-5 text-green-600 transition-all duration-300" />, 
      collapsed: <Plus className="h-5 w-5 text-green-600 transition-all duration-300" /> 
    },
    { 
      expanded: <ArrowDown className="h-5 w-5 text-purple-600 transition-all duration-500 rotate-180" />, 
      collapsed: <ArrowRight className="h-5 w-5 text-purple-600 transition-all duration-500" /> 
    },
    { 
      expanded: <Triangle className="h-5 w-5 text-orange-600 transition-all duration-300 rotate-180" />, 
      collapsed: <Triangle className="h-5 w-5 text-orange-600 transition-all duration-300" /> 
    },
    { 
      expanded: <Square className="h-5 w-5 text-red-600 transition-all duration-300 rotate-45" />, 
      collapsed: <Square className="h-5 w-5 text-red-600 transition-all duration-300" /> 
    }
  ];

  const iconSet = iconConfigs[moduleIndex % iconConfigs.length];
  return isExpanded ? iconSet.expanded : iconSet.collapsed;
};