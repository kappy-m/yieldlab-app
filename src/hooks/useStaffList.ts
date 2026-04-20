"use client";

/** スタッフリスト。V1 はモックデータ内包、V2 で /api/users に切り替える。*/
export interface StaffMember {
  id: number;
  name: string;
}

export function useStaffList(): StaffMember[] {
  return [
    { id: 1, name: "佐藤 花子" },
    { id: 2, name: "田村 誠" },
    { id: 3, name: "中村 浩二" },
    { id: 4, name: "山田 太郎" },
  ];
}
