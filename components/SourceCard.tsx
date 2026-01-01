
import React from 'react';
import { FileText, FileSpreadsheet, Globe, File } from 'lucide-react';
import { Source } from '../types';

interface SourceCardProps {
  source: Source;
  onClick?: () => void;
  isActive?: boolean;
}

const SourceCard: React.FC<SourceCardProps> = ({ source, onClick, isActive }) => {
  const getIcon = () => {
    switch (source.type) {
      case 'PDF': return <FileText className={`w-4 h-4 ${isActive ? 'text-belhard-blue' : 'text-red-500'}`} />;
      case 'XLSX': return <FileSpreadsheet className={`w-4 h-4 ${isActive ? 'text-belhard-blue' : 'text-green-600'}`} />;
      case 'DOC': return <File className={`w-4 h-4 ${isActive ? 'text-belhard-blue' : 'text-blue-500'}`} />;
      case 'WEB': return <Globe className="w-4 h-4 text-belhard-blue" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`
        group relative flex flex-col justify-between p-3 w-48 h-28 bg-white border rounded-xl transition-all cursor-pointer overflow-hidden
        ${isActive 
          ? 'border-belhard-blue ring-1 ring-belhard-blue shadow-md bg-blue-50/30' 
          : 'border-gray-200 hover:border-belhard-blue hover:shadow-md'
        }
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-blue-100' : 'bg-gray-50 group-hover:bg-belhard-light'}`}>
          {getIcon()}
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${isActive ? 'bg-belhard-blue text-white' : 'text-gray-400 bg-gray-100'}`}>
          {source.type}
        </span>
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className={`text-xs font-medium line-clamp-2 leading-tight transition-colors ${isActive ? 'text-belhard-blue' : 'text-gray-800 group-hover:text-belhard-blue'}`}>
          {source.title}
        </h4>
        <p className="text-[10px] text-gray-400 mt-1 truncate">
          {source.citation}
        </p>
      </div>
      
      {/* Selection Indicator Arrow */}
      {isActive && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-belhard-blue rotate-45 z-10"></div>
      )}
    </div>
  );
};

export default SourceCard;
